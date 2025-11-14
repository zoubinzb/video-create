import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';
import imageGenerator from '../utils/image-generator.js';

class KeyframeGeneratorAgent {
  /**
   * 基于分镜脚本生成关键帧（每个镜头一张）
   */
  async generate(storyboard) {
    console.log('🎨 Agent 4: 关键帧生成器 - 开始生成...');
    
    try {
      const shots = storyboard.storyboard.shots || [];
      const keyframes = [];
      const outputDir = path.join(config.paths.output, 'keyframes');
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // 加载参考图片（人物形象）
      const referenceImagePath = path.join(config.paths.input, '20251112-203804.jpg');
      if (fs.existsSync(referenceImagePath)) {
        console.log(`\n📸 使用参考图片: ${path.basename(referenceImagePath)}`);
        console.log(`   所有关键帧中的人物形象将基于此图片生成\n`);
      } else {
        console.warn(`\n⚠️  参考图片不存在: ${referenceImagePath}`);
        console.warn(`   将不使用参考图片生成人物形象\n`);
      }
      
      const totalShots = shots.length;
      
      console.log(`\n📸 为 ${totalShots} 个镜头生成关键帧...`);
      console.log(`   每个镜头将生成一张关键帧\n`);
      
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const nextShot = i < shots.length - 1 ? shots[i + 1] : null;
        const previousShot = i > 0 ? shots[i - 1] : null;
        
        console.log(`\n  📸 镜头 ${shot.shotNumber}/${totalShots}: ${shot.timeRange}秒`);
        
        // 生成关键帧
        const prompt = this.buildKeyframePrompt(shot, storyboard, i, previousShot, nextShot);
        console.log(`    📝 关键帧提示词:`);
        console.log(`       ${prompt}`);
        const keyframe = await this.generateKeyframe(shot, storyboard, i, previousShot, nextShot);
        console.log(`    ✅ 关键帧生成完成: ${keyframe.url}`);
        
        keyframes.push({
          shotNumber: shot.shotNumber,
          timeRange: shot.timeRange,
          startTime: shot.startTime,
          endTime: shot.endTime,
          keyframeA: keyframe, // 保持兼容性，使用 keyframeA 字段
          keyframeB: keyframe, // 保持兼容性，使用 keyframeB 字段（指向同一个）
          shot: shot, // 保存分镜信息
          nextShot: nextShot, // 保存下一个镜头信息（用于过渡）
        });
      }
      
      const result = {
        storyboard, // 保存 storyboard 以便后续使用
        keyframes,
        timestamp: new Date().toISOString(),
      };

      console.log(`\n✅ 关键帧生成完成: ${keyframes.length} 个镜头，共 ${keyframes.length} 个关键帧`);
      return result;
    } catch (error) {
      console.error('❌ 关键帧生成失败:', error);
      throw error;
    }
  }

  /**
   * 生成关键帧（每个镜头一张）
   */
  async generateKeyframe(shot, storyboard, index, previousShot, nextShot) {
    try {
      const prompt = this.buildKeyframePrompt(shot, storyboard, index, previousShot, nextShot);
      const keyframePath = path.join(config.paths.output, 'keyframes', `shot_${shot.shotNumber}.png`);
      
      // 生成关键帧图像
      await this.renderKeyframeImage(prompt, keyframePath, shot, null, nextShot);
      
      const url = `./keyframes/shot_${shot.shotNumber}.png`;
      
      return {
        path: keyframePath,
        url: url,
        absolutePath: keyframePath,
        shotNumber: shot.shotNumber,
        prompt: prompt,
        nextShotNumber: nextShot ? nextShot.shotNumber : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`  ❌ 关键帧生成失败:`, error.message);
      throw error;
    }
  }

  /**
   * 构建关键帧的提示词（合并了A和B的逻辑）
   */
  buildKeyframePrompt(shot, storyboard, index, previousShot, nextShot) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 重要：在提示词开头就强调必须使用参考图片中的卡通形象
    let prompt = `IMPORTANT: You must use the exact cartoon character from the reference image provided. `;
    prompt += `Style: soft 3D cartoon, pastel colors, smooth movement, very kid-friendly, warm lighting, no text.”`
    prompt += `The scene is bright, soft, colorful, and friendly.`
    prompt += `The character's appearance, design, colors, and style must be identical to the reference image. `;
    prompt += `Do not create a new character or modify the character design. `;
    prompt += `Keyframe for shot ${shot.shotNumber}: `;
    prompt += `${shot.composition}, ${shot.framing}, ${shot.lighting}`;
    
    // 再次强调参考图片
    prompt += `, use the exact same cartoon character from the reference image, maintain character consistency`;
    
    // 添加动作描述
    if (shot.action) {
      prompt += `, ${shot.action}`;
    }
    
    // 添加风格
    if (style) {
      prompt += `, ${style} style`;
    }
    
    // 添加色彩方案
    if (colors) {
      prompt += `, ${colors} color palette`;
    }
    
    // 如果有前一个镜头，添加过渡提示
    if (previousShot) {
      prompt += `, visually connected to previous shot (shot ${previousShot.shotNumber}), smooth transition`;
    }
    
    // 如果有下一个镜头，添加过渡提示
    if (nextShot) {
      prompt += `, will transition to next shot (shot ${nextShot.shotNumber})`;
    }
    
    prompt += `, cinematic, high quality, detailed, still frame, keyframe`;
    
    return prompt;
  }

  /**
   * 渲染关键帧图像（使用图像生成 API 或占位符）
   */
  async renderKeyframeImage(prompt, outputPath, shot, type, nextShot = null) {
    try {
      // 尝试使用图像生成 API 生成真实图像
      try {
        // 检查参考图片是否存在
        const referenceImagePath = path.join(config.paths.input, '20251112-203804.jpg');
        const options = {
          width: 1920,
          height: 1080,
          style: 'cinematic',
        };
        
        // 如果参考图片存在，添加到选项中
        if (fs.existsSync(referenceImagePath)) {
          options.referenceImage = referenceImagePath;
          console.log(`   📸 参考图片路径: ${referenceImagePath}`);
          console.log(`   📸 参考图片存在: ${fs.existsSync(referenceImagePath)}`);
        } else {
          console.warn(`   ⚠️  参考图片不存在: ${referenceImagePath}`);
        }
        
        await imageGenerator.generateImage(prompt, outputPath, options);
        console.log(`   ✅ 使用图像生成 API 生成关键帧${options.referenceImage ? '（使用参考图片）' : '（未使用参考图片）'}`);
        return outputPath;
      } catch (apiError) {
        // 如果 API 不可用，使用改进的占位符
        console.log(`   ⚠️  图像生成 API 不可用，使用改进的占位符`);
        return await this.generateImprovedPlaceholder(prompt, outputPath, shot, type, nextShot);
      }
    } catch (error) {
      console.error(`❌ 关键帧图像生成失败:`, error.message);
      throw error;
    }
  }

  /**
   * 生成改进的占位符图像（基于提示词内容）
   */
  async generateImprovedPlaceholder(prompt, outputPath, shot, type, nextShot) {
    try {
      const { createCanvas } = await import('canvas');
      const canvas = createCanvas(1920, 1080);
      const ctx = canvas.getContext('2d');
      
      // 从提示词中提取颜色
      const colors = this.extractColorsFromPrompt(prompt);
      
      // 创建基于提示词的背景
      if (colors.length > 0) {
        const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
        colors.forEach((color, index) => {
          gradient.addColorStop(index / (colors.length - 1 || 1), color);
        });
        ctx.fillStyle = gradient;
      } else {
        // 默认渐变
        const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
        gradient.addColorStop(0, '#2d1b4e');
        gradient.addColorStop(0.5, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
      }
      ctx.fillRect(0, 0, 1920, 1080);
      
      // 添加基于提示词的视觉元素
      this.addVisualHints(ctx, prompt, shot);
      
      // 添加关键帧标识（较小，不遮挡主要内容）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Keyframe Shot ${shot.shotNumber}`, 960, 50);
      
      // 添加时间信息
      ctx.font = '30px Arial';
      ctx.fillText(`${shot.timeRange}秒`, 960, 90);
      
      // 添加边框
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, 1880, 1040);
      
      // 保存图像
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      return outputPath;
    } catch (error) {
      console.warn(`⚠️ 占位符生成失败:`, error.message);
      throw error;
    }
  }

  /**
   * 从提示词中提取颜色代码
   */
  extractColorsFromPrompt(prompt) {
    const colorRegex = /#([0-9A-Fa-f]{6})/g;
    const colors = [];
    let match;
    
    while ((match = colorRegex.exec(prompt)) !== null) {
      colors.push(`#${match[1]}`);
    }
    
    return colors;
  }

  /**
   * 添加视觉提示（基于提示词内容）
   */
  addVisualHints(ctx, prompt, shot) {
    const lowerPrompt = prompt.toLowerCase();
    
    // 根据提示词添加抽象视觉元素
    ctx.globalAlpha = 0.4;
    
    // 天空/云朵
    if (lowerPrompt.includes('sky') || lowerPrompt.includes('cloud')) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < 8; i++) {
        const x = (1920 / 8) * i + 100;
        const y = 200 + Math.sin(i) * 50;
        ctx.beginPath();
        ctx.arc(x, y, 80 + Math.random() * 40, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // 地面/草地
    if (lowerPrompt.includes('ground') || lowerPrompt.includes('grass') || lowerPrompt.includes('meadow')) {
      ctx.fillStyle = 'rgba(34, 139, 34, 0.3)';
      ctx.fillRect(0, 800, 1920, 280);
    }
    
    // 光效
    if (lowerPrompt.includes('light') || lowerPrompt.includes('bright') || lowerPrompt.includes('sun')) {
      const gradient = ctx.createRadialGradient(960, 300, 0, 960, 300, 800);
      gradient.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1920, 1080);
    }
    
    // 角色/人物
    if (lowerPrompt.includes('character') || lowerPrompt.includes('sparky') || lowerPrompt.includes('creature')) {
      ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(960, 600, 100, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(930, 580, 15, 0, Math.PI * 2);
      ctx.arc(990, 580, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1.0;
  }
}

export default new KeyframeGeneratorAgent();

