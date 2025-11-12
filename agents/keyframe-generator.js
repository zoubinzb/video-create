import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';
import imageGenerator from '../utils/image-generator.js';

class KeyframeGeneratorAgent {
  /**
   * 基于分镜脚本生成 AB 关键帧
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
      
      // 测试模式：只处理前3个镜头
      const maxShots = 3;
      const shotsToProcess = shots.slice(0, maxShots);
      const totalShots = shots.length;
      
      console.log(`\n📸 为 ${shotsToProcess.length} 个镜头生成 AB 关键帧（测试模式：仅处理前${maxShots}个，共${totalShots}个镜头）...`);
      console.log(`   每个镜头将生成关键帧 A（起始）和关键帧 B（结束）\n`);
      
      for (let i = 0; i < shotsToProcess.length; i++) {
        const shot = shotsToProcess[i];
        const nextShot = i < shotsToProcess.length - 1 ? shotsToProcess[i + 1] : null;
        
        console.log(`\n  📸 镜头 ${shot.shotNumber}/${totalShots}: ${shot.timeRange}秒`);
        
        // 生成关键帧 A（镜头起始帧）
        const promptA = this.buildKeyframeAPrompt(shot, storyboard, i);
        console.log(`    📝 关键帧 A 提示词:`);
        console.log(`       ${promptA}`);
        const keyframeA = await this.generateKeyframeA(shot, storyboard, i);
        console.log(`    ✅ 关键帧 A 生成完成: ${keyframeA.url}`);
        
        // 生成关键帧 B（镜头结束帧，始终是当前镜头的结束状态）
        const promptB = this.buildKeyframeBPrompt(shot, nextShot, storyboard, i);
        console.log(`    📝 关键帧 B 提示词:`);
        console.log(`       ${promptB}`);
        const keyframeB = await this.generateKeyframeB(shot, nextShot, storyboard, i);
        console.log(`    ✅ 关键帧 B 生成完成: ${keyframeB.url}`);
        
        keyframes.push({
          shotNumber: shot.shotNumber,
          timeRange: shot.timeRange,
          startTime: shot.startTime,
          endTime: shot.endTime,
          keyframeA: keyframeA,
          keyframeB: keyframeB,
          shot: shot, // 保存分镜信息
          nextShot: nextShot, // 保存下一个镜头信息（用于过渡）
        });
      }
      
      const result = {
        storyboard, // 保存 storyboard 以便后续使用
        keyframes,
        timestamp: new Date().toISOString(),
      };

      console.log(`\n✅ AB 关键帧生成完成: ${keyframes.length} 个镜头，共 ${keyframes.length * 2} 个关键帧`);
      return result;
    } catch (error) {
      console.error('❌ 关键帧生成失败:', error);
      throw error;
    }
  }

  /**
   * 生成关键帧 A（镜头起始帧）
   */
  async generateKeyframeA(shot, storyboard, index) {
    try {
      const prompt = this.buildKeyframeAPrompt(shot, storyboard, index);
      const keyframePath = path.join(config.paths.output, 'keyframes', `shot_${shot.shotNumber}_A.png`);
      
      // 提示词已在调用处打印，这里不再重复
      
      // 生成关键帧图像
      await this.renderKeyframeImage(prompt, keyframePath, shot, 'A');
      
      const url = `./keyframes/shot_${shot.shotNumber}_A.png`;
      
      return {
        path: keyframePath,
        url: url,
        absolutePath: keyframePath,
        shotNumber: shot.shotNumber,
        type: 'A',
        prompt: prompt,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`  ❌ 关键帧 A 生成失败:`, error.message);
      throw error;
    }
  }

  /**
   * 生成关键帧 B（镜头结束帧）
   * 关键帧 B 始终是当前镜头的结束状态，而不是下一个镜头的起始状态
   */
  async generateKeyframeB(shot, nextShot, storyboard, index) {
    try {
      // 关键帧 B 始终是当前镜头的结束状态
      const prompt = this.buildKeyframeBPrompt(shot, nextShot, storyboard, index);
      const keyframePath = path.join(config.paths.output, 'keyframes', `shot_${shot.shotNumber}_B.png`);
      
      // 提示词已在调用处打印，这里不再重复
      
      // 生成关键帧图像
      await this.renderKeyframeImage(prompt, keyframePath, shot, 'B', nextShot);
      
      const url = `./keyframes/shot_${shot.shotNumber}_B.png`;
      
      return {
        path: keyframePath,
        url: url,
        absolutePath: keyframePath,
        shotNumber: shot.shotNumber,
        type: 'B',
        prompt: prompt,
        nextShotNumber: nextShot ? nextShot.shotNumber : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`  ❌ 关键帧 B 生成失败:`, error.message);
      throw error;
    }
  }

  /**
   * 构建关键帧 A 的提示词（镜头起始状态）
   */
  buildKeyframeAPrompt(shot, storyboard, index) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 关键帧 A 是镜头的起始状态
    let prompt = `Keyframe A (start of shot ${shot.shotNumber}): `;
    prompt += `${shot.composition}, ${shot.framing}, ${shot.lighting}`;
    
    if (shot.action) {
      // 提取动作的起始状态
      prompt += `, ${shot.action} - initial state`;
    }
    
    if (style) {
      prompt += `, ${style} style`;
    }
    
    if (colors) {
      prompt += `, ${colors} color palette`;
    }
    
    // 如果有前一个镜头，添加过渡提示
    if (index > 0) {
      prompt += `, visually connected to previous shot, smooth transition`;
    }
    
    prompt += `, cinematic, high quality, detailed, still frame, keyframe`;
    
    return prompt;
  }

  /**
   * 构建关键帧 B 的提示词（镜头结束状态）
   * 关键帧 B 始终是当前镜头的结束状态，而不是下一个镜头的起始状态
   */
  buildKeyframeBPrompt(shot, nextShot, storyboard, index) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 关键帧 B 始终是当前镜头的结束状态
    let prompt = `Keyframe B (end of shot ${shot.shotNumber}): `;
    prompt += `${shot.composition}, ${shot.framing}, ${shot.lighting}`;
    
    // 描述动作的结束状态
    if (shot.action) {
      // 提取动作描述，并强调这是结束状态
      let actionDescription = shot.action;
      
      // 如果有下一个镜头，可以添加一些过渡暗示，但保持当前镜头的特征
      if (nextShot) {
        // 添加动作完成的暗示，但不改变当前镜头的基本构图和内容
        prompt += `, ${actionDescription} - completion state, action reaching its conclusion`;
        // 可以添加一些视觉过渡的暗示，但保持当前镜头的构图
        prompt += `, preparing for transition to next scene`;
      } else {
        // 最后一个镜头，使用最终状态
        prompt += `, ${actionDescription} - final state, conclusion`;
      }
    } else {
      // 没有明确动作描述时，使用结束状态
      if (nextShot) {
        prompt += `, scene reaching completion, preparing for transition`;
      } else {
        prompt += `, final state, conclusion`;
      }
    }
    
    if (style) {
      prompt += `, ${style} style`;
    }
    
    if (colors) {
      prompt += `, ${colors} color palette`;
    }
    
    // 如果有下一个镜头，添加过渡提示，但强调这是当前镜头的结束
    if (nextShot) {
      prompt += `, end of shot ${shot.shotNumber}, will transition to shot ${nextShot.shotNumber}`;
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
        await imageGenerator.generateImage(prompt, outputPath, {
          width: 1920,
          height: 1080,
          style: 'cinematic',
        });
        console.log(`   ✅ 使用图像生成 API 生成关键帧 ${type}`);
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
      ctx.fillText(`Keyframe ${type}`, 960, 50);
      
      // 添加时间信息
      ctx.font = '30px Arial';
      ctx.fillText(`${shot.timeRange}秒`, 960, 90);
      
      // 添加边框
      ctx.strokeStyle = type === 'A' ? '#00ff88' : '#ff8800';
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

