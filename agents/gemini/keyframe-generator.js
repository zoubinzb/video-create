import fs from 'fs';
import path from 'path';
import config from '../../config/config.js';
import imageGenerator from '../../utils/image-generator.js';
import { batchConcurrent } from '../../utils/utils.js';

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
    // 必须使用 keyframePrompt，如果没有则抛出错误
    if (!shot.keyframePrompt) {
      throw new Error(`镜头 ${shot.shotNumber} 缺少必需的 keyframePrompt 字段`);
    }
    
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 在提供的提示词基础上添加必要的补充信息
    const parts = [
      shot.keyframePrompt,
      'This is a STATIC keyframe image showing the INITIAL STATE before any action begins',
      'cinematic, high quality, detailed, still frame, start keyframe, initial moment'
    ];
    
    // 如果有参考图片，使用风格参考而不是强制使用相同角色
    const hasReference = fs.existsSync(this.referenceImagePath);
    if (hasReference) {
      parts.push('Use the reference image as a visual style guide for character design, color palette, and animation style.');
      parts.push('Match the visual style, color scheme, and artistic approach of the reference image.');
      parts.push('Maintain consistency with the reference image\'s artistic style while following the scene description.');
    }
    
    if (style) parts.push(`${style} style`);
    if (colors) parts.push(`${colors} color palette`);
    
    if (previousShot) {
      parts.push(`visually connected to previous shot (shot ${previousShot.shotNumber}), smooth transition from previous scene`);
    }
    
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

