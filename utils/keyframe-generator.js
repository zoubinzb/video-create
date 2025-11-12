import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';

class KeyframeGenerator {
  /**
   * 生成关键帧图像
   * 使用 Gemini 的图像生成能力或保存本地路径
   */
  async generateKeyframe(prompt, shotNumber, outputDir) {
    try {
      // 生成关键帧图像路径
      const keyframePath = path.join(outputDir, `keyframe_${shotNumber}.png`);
      
      // 尝试使用 Gemini 生成图像（如果支持）
      // 如果不支持，使用 Canvas 生成占位符
      try {
        // 这里可以集成真实的图像生成 API
        // 例如：Stable Diffusion, DALL-E, Midjourney 等
        // 目前先使用 Canvas 生成高质量的关键帧图像
        
        const { createCanvas } = await import('canvas');
        const canvas = createCanvas(1920, 1080);
        const ctx = canvas.getContext('2d');
        
        // 创建更精美的关键帧图像
        const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
        gradient.addColorStop(0, '#2d1b4e');
        gradient.addColorStop(0.5, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1920, 1080);
        
        // 添加关键帧标识
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`关键帧 ${shotNumber}`, 960, 400);
        
        // 添加提示词预览
        ctx.font = '30px Arial';
        const words = prompt.split(',');
        let y = 500;
        for (let i = 0; i < Math.min(words.length, 5); i++) {
          ctx.fillText(words[i].trim(), 960, y);
          y += 50;
        }
        
        // 添加边框
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 5;
        ctx.strokeRect(50, 50, 1820, 980);
        
        // 保存图像
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(keyframePath, buffer);
        
        // 返回关键帧信息
        // 使用相对路径作为URL，便于访问
        const relativePath = path.relative(config.paths.output, keyframePath);
        const url = `./keyframes/${path.basename(keyframePath)}`;
        
        return {
          path: keyframePath,
          url: url, // 相对路径URL
          absolutePath: keyframePath, // 绝对路径
          shotNumber: shotNumber,
          prompt: prompt,
          type: 'keyframe',
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.warn(`⚠️ 关键帧图像生成失败，使用简单占位符:`, error.message);
        // 如果 Canvas 失败，创建简单的占位符
        return {
          path: keyframePath,
          url: `file://${keyframePath}`,
          shotNumber: shotNumber,
          prompt: prompt,
          type: 'keyframe',
          note: '使用占位符',
        };
      }
    } catch (error) {
      console.error(`❌ 生成关键帧失败 (镜头 ${shotNumber}):`, error);
      throw error;
    }
  }

  /**
   * 为多个镜头生成关键帧（支持关键帧之间的关联性）
   */
  async generateKeyframes(shots, storyboard) {
    const keyframes = [];
    const outputDir = path.join(config.paths.output, 'keyframes');
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`\n🎨 开始生成关键帧图像...`);
    console.log(`   目标: ${shots.length} 个关键帧，确保视觉连贯性\n`);
    
    let previousKeyframe = null;
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const prompt = shot.prompt || this.buildKeyframePrompt(shot, storyboard);
      
      // 如果有前一个关键帧，在提示词中加入关联信息
      let enhancedPrompt = prompt;
      if (previousKeyframe && i > 0) {
        // 添加与前一个关键帧的过渡提示
        enhancedPrompt = `${prompt}, visually connected to previous keyframe, smooth transition`;
      }
      
      console.log(`  🖼️  生成关键帧 ${shot.shotNumber}/${shots.length}...`);
      
      try {
        const keyframe = await this.generateKeyframe(enhancedPrompt, shot.shotNumber, outputDir);
        
        // 添加关联信息
        if (previousKeyframe) {
          keyframe.previousKeyframe = {
            shotNumber: previousKeyframe.shotNumber,
            url: previousKeyframe.url,
          };
        }
        if (i < shots.length - 1) {
          // 标记有下一个关键帧
          keyframe.hasNextKeyframe = true;
        }
        
        keyframes.push(keyframe);
        previousKeyframe = keyframe;
        console.log(`  ✅ 关键帧 ${shot.shotNumber} 生成完成`);
      } catch (error) {
        console.error(`  ❌ 关键帧 ${shot.shotNumber} 生成失败:`, error.message);
        // 即使失败也添加占位符
        keyframes.push({
          path: null,
          url: null,
          shotNumber: shot.shotNumber,
          prompt: prompt,
          type: 'keyframe',
          error: error.message,
        });
      }
    }
    
    console.log(`\n✅ 关键帧生成完成: ${keyframes.length} 个`);
    return keyframes;
  }

  /**
   * 构建关键帧提示词（更专注于静态画面）
   */
  buildKeyframePrompt(shot, storyboard) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 关键帧提示词更注重构图和视觉细节
    let prompt = `${shot.composition}, ${shot.framing}, ${shot.lighting}`;
    
    if (shot.action) {
      prompt += `, ${shot.action}`;
    }
    
    if (style) {
      prompt += `, ${style} style`;
    }
    
    if (colors) {
      prompt += `, ${colors} color palette`;
    }
    
    prompt += `, cinematic, high quality, detailed, still frame, keyframe`;
    
    return prompt;
  }
}

export default new KeyframeGenerator();

