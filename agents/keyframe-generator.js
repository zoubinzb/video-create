import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import imageGenerator from '../utils/image-generator.js';
import { batchConcurrent } from '../utils/utils.js';

const IMAGE_CONFIG = {
  width: 1920,   // 1080p 宽度
  height: 1080,  // 1080p 高度
  aspectRatio: '16:9',  // 1080p 宽高比
  style: 'cinematic',
  referenceImageName: '20251112-203804.jpg'
};

class KeyframeGeneratorAgent {
  constructor() {
    this.outputDir = path.join(config.paths.output, 'keyframes');
    this.referenceImagePath = path.join(config.paths.input, IMAGE_CONFIG.referenceImageName);
  }

  // 检查并初始化输出目录和参考图片
  _initialize() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const hasReference = fs.existsSync(this.referenceImagePath);
    if (hasReference) {
      console.log(`📸 使用参考图片: ${path.basename(this.referenceImagePath)}\n`);
    } else {
      console.warn(`⚠️  参考图片不存在，将不使用参考图片\n`);
    }
    
    return hasReference;
  }

  // 生成关键帧数据结构
  _createKeyframeData(shot, keyframe, nextShot) {
    return {
      shotNumber: shot.shotNumber,
      timeRange: shot.timeRange,
      startTime: shot.startTime,
      endTime: shot.endTime,
      keyframeA: keyframe,
      keyframeB: keyframe,
      shot,
      nextShot
    };
  }

  // 基于分镜脚本生成关键帧（每个镜头一张）
  async generate(storyboard) {
    console.log('🎨 Agent 4: 关键帧生成器 - 开始生成...');
    
    try {
      this._initialize();
      
      const shots = storyboard.storyboard.shots || [];
      console.log(`📸 为 ${shots.length} 个镜头生成关键帧...\n`);
      
      // 准备所有任务数据
      const tasks = shots.map((shot, i) => ({
        shot,
        storyboard,
        context: {
          previousShot: i > 0 ? shots[i - 1] : null,
          nextShot: i < shots.length - 1 ? shots[i + 1] : null
        },
        keyframeData: null
      }));
      
      // 使用并发控制工具函数，每批5个
      await batchConcurrent(tasks,
        async (task) => {
          console.log(`  📸 镜头 ${task.shot.shotNumber}/${shots.length}: ${task.shot.timeRange}秒`);
          const keyframe = await this.generateKeyframe(task.shot, task.storyboard, task.context);
          task.keyframeData = this._createKeyframeData(task.shot, keyframe, task.context.nextShot);
        },
        {
          concurrency: 5,
          startIndex: 0,
          onBatchStart: (batch, batchNum, total) => {
            console.log(`\n📦 批次 ${batchNum}/${total}: 镜头 ${batch[0].shot.shotNumber}-${batch[batch.length - 1].shot.shotNumber}`);
          },
          onBatchComplete: (batch, batchNum) => {
            console.log(`  ✅ 批次 ${batchNum} 完成\n`);
          }
        }
      );
      
      const keyframes = tasks.map(task => task.keyframeData);

      console.log(`✅ 关键帧生成完成: ${keyframes.length} 个镜头\n`);
      
      return {
        storyboard,
        keyframes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 关键帧生成失败:', error);
      throw error;
    }
  }

  // 生成单个关键帧
  async generateKeyframe(shot, storyboard, context) {
    try {
      const prompt = this._buildPrompt(shot, storyboard, context);
      const keyframePath = path.join(this.outputDir, `shot_${shot.shotNumber}.png`);
      
      await this._renderImage(prompt, keyframePath, shot, context.nextShot);
      
      return {
        path: keyframePath,
        url: `./keyframes/shot_${shot.shotNumber}.png`,
        absolutePath: keyframePath,
        shotNumber: shot.shotNumber,
        prompt,
        nextShotNumber: context.nextShot?.shotNumber || null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`  ❌ 镜头 ${shot.shotNumber} 生成失败:`, error.message);
      throw error;
    }
  }

  // 构建关键帧提示词（生成起始帧）
  _buildPrompt(shot, storyboard, { previousShot, nextShot }) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    const parts = [
      'IMPORTANT: You must use the exact cartoon character from the reference image provided.',
      'Cocomelon animation style: bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere.',
      'Style: soft 3D cartoon, pastel colors, smooth movement, very kid-friendly, warm lighting, no text.',
      'The scene is bright, soft, colorful, and friendly.',
      'The character\'s appearance, design, colors, and style must be identical to the reference image.',
      'Do not create a new character or modify the character design.',
      `Start frame (initial keyframe) for shot ${shot.shotNumber}: ${shot.composition}, ${shot.framing}, ${shot.lighting}`,
      'This is the STARTING state of the shot, showing the initial moment before any action begins',
      'use the exact same cartoon character from the reference image, maintain character consistency'
    ];
    
    // 如果有动作描述，强调这是动作的初始状态
    if (shot.action) {
      parts.push(`${shot.action} - initial state, action just beginning`);
    } else {
      parts.push('scene at its initial state, ready to begin');
    }
    
    if (style) parts.push(`${style} style`);
    if (colors) parts.push(`${colors} color palette`);
    
    // 如果有前一个镜头，添加过渡提示（从上一个镜头的结束过渡到当前镜头的开始）
    if (previousShot) {
      parts.push(`visually connected to previous shot (shot ${previousShot.shotNumber}), smooth transition from previous scene`);
    }
    
    parts.push('cinematic, high quality, detailed, still frame, start keyframe, initial moment');
    
    return parts.join(', ');
  }

  // 渲染关键帧图像
  async _renderImage(prompt, outputPath, shot, nextShot) {
    const options = { 
      ...IMAGE_CONFIG,
    };
    const hasReference = fs.existsSync(this.referenceImagePath);
    
    if (hasReference) {
      options.referenceImage = this.referenceImagePath;
    }
    
    await imageGenerator.generateImage(prompt, outputPath, options);
    console.log(`    ✅ 关键帧生成完成${hasReference ? '（使用参考图片）' : ''} (1080p, 1920x1080)`);
    return outputPath;
  }
}

export default new KeyframeGeneratorAgent();

