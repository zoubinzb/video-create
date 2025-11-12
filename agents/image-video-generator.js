import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';
import keyframeGenerator from '../utils/keyframe-generator.js';

class ImageVideoGeneratorAgent {
  /**
   * 生成视频素材（使用关键帧 + veo-3.1-generate-preview）
   */
  async generate(storyboard) {
    console.log('🖼️ Agent 4: 图像/视频生成器 - 开始生成...');
    
    try {
      const shots = storyboard.storyboard.shots || [];
      const materials = [];
      
      // 第一步：生成所有关键帧
      console.log('\n📸 步骤 1/2: 生成关键帧图像...');
      const keyframes = await keyframeGenerator.generateKeyframes(shots, storyboard);
      
      // 第二步：基于关键帧生成视频
      console.log('\n🎬 步骤 2/2: 基于关键帧生成视频...');
      
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const keyframe = keyframes[i];
        const previousKeyframe = i > 0 ? keyframes[i - 1] : null;
        const nextKeyframe = i < shots.length - 1 ? keyframes[i + 1] : null;
        const prompt = shot.prompt || this.buildPrompt(shot, storyboard);
        
        const material = {
          shotNumber: shot.shotNumber,
          timeRange: shot.timeRange,
          startTime: shot.startTime,
          endTime: shot.endTime,
          prompt: prompt,
          type: 'video',
          path: null,
          status: 'pending',
          keyframe: keyframe, // 当前关键帧（A）
          previousKeyframe: previousKeyframe, // 前一个关键帧（用于过渡）
          nextKeyframe: nextKeyframe, // 下一个关键帧（B）
        };
        
        materials.push(material);
        
        console.log(`\n  🎬 镜头 ${shot.shotNumber}/${shots.length}: ${shot.timeRange}秒 - ${shot.framing}`);
        console.log(`     关键帧A: ${keyframe.url || '无'}`);
        if (nextKeyframe) {
          console.log(`     关键帧B: ${nextKeyframe.url || '无'} (下一个镜头)`);
        }
        console.log(`     提示词: ${prompt.substring(0, 100)}...`);
        
        try {
          // 生成视频文件路径
          const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
          
          // 构建基于AB关键帧的视频提示词
          const videoPrompt = this.buildVideoPromptFromKeyframe(prompt, keyframe, shot, previousKeyframe, nextKeyframe);
          
          // 使用 veo-3.1-generate-preview 生成视频
          await geminiClient.generateVideo(videoPrompt, videoPath);
          
          material.path = videoPath;
          material.status = 'generated';
          console.log(`  ✅ 镜头 ${shot.shotNumber} 视频生成完成（基于关键帧A${nextKeyframe ? '→B' : ''}）`);
        } catch (error) {
          console.error(`  ❌ 镜头 ${shot.shotNumber} 视频生成失败:`, error.message);
          material.status = 'failed';
          material.error = error.message;
          
          // 如果视频生成失败，使用关键帧作为后备
          if (keyframe && keyframe.path) {
            material.path = keyframe.path;
            material.type = 'image';
            material.status = 'keyframe_fallback';
            console.log(`  ⚠️  使用关键帧图像作为后备`);
          }
        }
      }
      
      const result = {
        storyboard,
        materials,
        keyframes: keyframes, // 保存所有关键帧信息
        timestamp: new Date().toISOString(),
      };

      const successCount = materials.filter(m => m.status === 'generated').length;
      console.log(`\n✅ 素材生成完成: ${successCount}/${materials.length} 个视频成功生成`);
      console.log(`📸 关键帧: ${keyframes.length} 个`);
      return result;
    } catch (error) {
      console.error('❌ 素材生成失败:', error);
      throw error;
    }
  }
  
  /**
   * 基于关键帧构建视频提示词（支持AB关键帧）
   */
  buildVideoPromptFromKeyframe(basePrompt, keyframe, shot, previousKeyframe = null, nextKeyframe = null) {
    // 在基础提示词中加入关键帧参考信息
    let videoPrompt = `Based on keyframe A: ${basePrompt}`;
    
    // 如果有前一个关键帧，添加过渡信息
    if (previousKeyframe && previousKeyframe.url) {
      videoPrompt += `, transition from previous keyframe (shot ${previousKeyframe.shotNumber})`;
    }
    
    // 如果有下一个关键帧，添加过渡目标（AB关键帧）
    if (nextKeyframe && nextKeyframe.url) {
      videoPrompt += `, transition to keyframe B (shot ${nextKeyframe.shotNumber}), smooth motion from A to B`;
    }
    
    // 添加镜头运动信息
    if (shot.movement && shot.movement !== '静止') {
      videoPrompt += `, ${shot.movement} camera movement`;
    }
    
    // 添加时间信息
    const duration = shot.endTime - shot.startTime;
    videoPrompt += `, ${duration} seconds duration`;
    
    // 确保视频连贯性
    videoPrompt += `, cinematic motion, high quality, consistent style and visual continuity`;
    
    return videoPrompt;
  }

  /**
   * 构建视频生成提示词
   */
  buildPrompt(shot, storyboard) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 构建详细的视频提示词
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
    
    prompt += `, cinematic, high quality, detailed`;
    
    return prompt;
  }

  /**
   * 生成单个占位符图像（作为后备方案）
   */
  async generatePlaceholderImage(material) {
    try {
      const { createCanvas } = await import('canvas');
      
      const canvas = createCanvas(1920, 1080);
      const ctx = canvas.getContext('2d');
      
      // 创建渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1920, 1080);
      
      // 添加文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`镜头 ${material.shotNumber}`, 960, 400);
      ctx.font = '40px Arial';
      ctx.fillText(material.timeRange, 960, 500);
      ctx.font = '30px Arial';
      ctx.fillText('视频生成失败 - 使用占位符', 960, 600);
      ctx.font = '25px Arial';
      ctx.fillText(material.prompt.substring(0, 60) + '...', 960, 700);
      
      // 保存图像
      const outputPath = path.join(config.paths.temp, `shot_${material.shotNumber}_placeholder.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      material.path = outputPath;
      material.type = 'image';
      material.status = 'placeholder';
    } catch (error) {
      console.warn('⚠️ 占位符图像生成失败:', error.message);
      material.status = 'failed';
    }
  }
}

export default new ImageVideoGeneratorAgent();

