import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import jimengClient from '../utils/jimeng-client.js';

const IMAGE_CONFIG = {
  width: 1920,
  height: 1080,
  style: 'cinematic',
  referenceImageName: '20251112-203804.jpg'
};

/**
 * 即梦关键帧生成器
 * 方案：一次调用生成所有关键帧
 */
class KeyframeGeneratorJimeng {
  constructor() {
    this.outputDir = path.join(config.paths.output, 'keyframes');
    this.referenceImagePath = path.join(config.paths.input, IMAGE_CONFIG.referenceImageName);
  }

  // 检查并初始化输出目录
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
  _createKeyframeData(shot, keyframePath, nextShot) {
    const keyframe = {
      path: keyframePath,
      url: `./keyframes/shot_${shot.shotNumber}.png`,
      absolutePath: keyframePath,
      shotNumber: shot.shotNumber,
      prompt: shot.prompt || shot.composition,
      nextShotNumber: nextShot?.shotNumber || null,
      timestamp: new Date().toISOString()
    };

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

  // 构建单个关键帧的提示词
  _buildPrompt(shot, storyboard, { previousShot, nextShot }) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    const parts = [
      'IMPORTANT: You must use the exact cartoon character from the reference image provided.',
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
    
    // 如果有前一个镜头，添加过渡提示
    if (previousShot) {
      parts.push(`visually connected to previous shot (shot ${previousShot.shotNumber}), smooth transition from previous scene`);
    }
    
    parts.push('cinematic, high quality, detailed, still frame, start keyframe, initial moment');
    
    return parts.join(', ');
  }

  // 主生成方法：一次调用生成所有关键帧
  async generate(storyboard) {
    console.log('🎨 Agent 4 (即梦): 关键帧生成器 - 一次生成所有关键帧\n');
    console.log('   方案说明: 使用即梦 API 一次调用生成所有关键帧\n');
    
    try {
      const hasReference = this._initialize();
      
      const shots = storyboard.storyboard.shots || [];
      console.log(`📸 为 ${shots.length} 个镜头生成关键帧...\n`);
      
      // 构建所有镜头的提示词
      const prompts = shots.map((shot, i) => {
        const context = {
          previousShot: i > 0 ? shots[i - 1] : null,
          nextShot: i < shots.length - 1 ? shots[i + 1] : null
        };
        return this._buildPrompt(shot, storyboard, context);
      });

      console.log('📸 调用即梦 API 批量生成关键帧...\n');
      
      // 调用即梦 API 批量生成图片
      const outputPaths = await jimengClient.generateBatchImages(
        prompts,
        this.outputDir,
        {
          referenceImage: hasReference ? this.referenceImagePath : null,
          width: IMAGE_CONFIG.width,
          height: IMAGE_CONFIG.height,
          prefix: 'shot'
        }
      );

      console.log(`✅ 成功生成 ${outputPaths.length} 个关键帧\n`);

      // 构建关键帧数据
      const keyframes = shots.map((shot, i) => {
        const keyframePath = outputPaths[i];
        const nextShot = i < shots.length - 1 ? shots[i + 1] : null;
        
        console.log(`  📸 镜头 ${shot.shotNumber}/${shots.length}: ${shot.timeRange}秒`);
        console.log(`    ✅ 关键帧生成完成: shot_${shot.shotNumber}.png`);
        
        return this._createKeyframeData(shot, keyframePath, nextShot);
      });

      console.log(`\n✅ 关键帧生成完成: ${keyframes.length} 个镜头\n`);
      
      return {
        storyboard,
        keyframes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 即梦关键帧生成失败:', error);
      throw error;
    }
  }
}

export default new KeyframeGeneratorJimeng();

