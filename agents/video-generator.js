import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';

class VideoGeneratorAgent {
  /**
   * 基于 AB 关键帧生成视频
   */
  async generate(keyframeData) {
    console.log('🎬 Agent 5: 视频生成器 - 开始生成...');
    
    try {
      const keyframes = keyframeData.keyframes || [];
      const materials = [];
      
      console.log(`\n🎬 基于 AB 关键帧生成 ${keyframes.length} 个视频片段...\n`);
      
      for (let i = 0; i < keyframes.length; i++) {
        const keyframe = keyframes[i];
        const shot = keyframe.shot;
        const keyframeA = keyframe.keyframeA;
        const keyframeB = keyframe.keyframeB;
        
        const material = {
          shotNumber: shot.shotNumber,
          timeRange: shot.timeRange,
          startTime: shot.startTime,
          endTime: shot.endTime,
          type: 'video',
          path: null,
          status: 'pending',
          keyframeA: keyframeA,
          keyframeB: keyframeB,
        };
        
        materials.push(material);
        
        console.log(`\n  🎬 镜头 ${shot.shotNumber}/${keyframes.length}: ${shot.timeRange}秒`);
        console.log(`     关键帧 A: ${keyframeA.url}`);
        console.log(`     关键帧 B: ${keyframeB.url}`);
        
        try {
          // 生成视频文件路径
          const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
          
          // 构建基于 AB 关键帧的视频提示词
          const videoPrompt = this.buildVideoPromptFromABKeyframes(shot, keyframeA, keyframeB, keyframeData);
          
          console.log(`     提示词: ${videoPrompt.substring(0, 100)}...`);
          
          // 准备关键帧图像路径（传入 A 和 B 关键帧）
          const referenceImages = [];
          if (keyframeA && keyframeA.path && fs.existsSync(keyframeA.path)) {
            referenceImages.push(keyframeA.path);
            console.log(`     📸 使用关键帧 A: ${keyframeA.path}`);
          }
          if (keyframeB && keyframeB.path && fs.existsSync(keyframeB.path)) {
            referenceImages.push(keyframeB.path);
            console.log(`     📸 使用关键帧 B: ${keyframeB.path}`);
          }
          
          // 使用 veo-3.1-generate-preview 生成视频，传入关键帧图像
          await geminiClient.generateVideo(
            videoPrompt, 
            videoPath, 
            'veo-3.1-generate-preview', 
            referenceImages
          );
          
          material.path = videoPath;
          material.status = 'generated';
          material.prompt = videoPrompt;
          console.log(`  ✅ 镜头 ${shot.shotNumber} 视频生成完成（A→B）`);
        } catch (error) {
          console.error(`  ❌ 镜头 ${shot.shotNumber} 视频生成失败:`, error.message);
          material.status = 'failed';
          material.error = error.message;
          
          // 如果视频生成失败，使用关键帧 A 作为后备
          if (keyframeA && keyframeA.path) {
            material.path = keyframeA.path;
            material.type = 'image';
            material.status = 'keyframe_fallback';
            console.log(`  ⚠️  使用关键帧 A 图像作为后备`);
          }
        }
      }
      
      const result = {
        keyframeData,
        materials,
        timestamp: new Date().toISOString(),
      };

      const successCount = materials.filter(m => m.status === 'generated').length;
      console.log(`\n✅ 视频生成完成: ${successCount}/${materials.length} 个视频成功生成`);
      return result;
    } catch (error) {
      console.error('❌ 视频生成失败:', error);
      throw error;
    }
  }

  /**
   * 基于 AB 关键帧构建视频提示词
   */
  buildVideoPromptFromABKeyframes(shot, keyframeA, keyframeB, keyframeData) {
    // 构建基于 AB 关键帧的视频提示词
    let videoPrompt = `Generate video from keyframe A to keyframe B: `;
    
    // 使用关键帧 A 的提示词作为起始
    videoPrompt += `Start from keyframe A (shot ${shot.shotNumber} start): ${keyframeA.prompt}`;
    
    // 添加过渡信息到关键帧 B
    if (keyframeB.nextShotNumber) {
      videoPrompt += `, transition smoothly to keyframe B (shot ${keyframeB.nextShotNumber} start): ${keyframeB.prompt}`;
    } else {
      videoPrompt += `, transition smoothly to keyframe B (shot ${shot.shotNumber} end): ${keyframeB.prompt}`;
    }
    
    // 添加镜头运动信息
    if (shot.movement && shot.movement !== '静止') {
      videoPrompt += `, ${shot.movement} camera movement`;
    }
    
    // 添加时间信息
    const duration = shot.endTime - shot.startTime;
    videoPrompt += `, ${duration} seconds duration`;
    
    // 添加风格信息（从 storyboard 中获取）
    const storyboard = keyframeData.storyboard;
    if (storyboard?.visualConcept?.visualConcept) {
      const concept = storyboard.visualConcept.visualConcept;
      if (concept?.style?.name) {
        videoPrompt += `, ${concept.style.name} style`;
      }
      if (concept?.colorPalette?.primary) {
        videoPrompt += `, ${concept.colorPalette.primary.join(', ')} color palette`;
      }
    }
    
    // 确保视频连贯性
    videoPrompt += `, smooth motion from keyframe A to keyframe B, cinematic, high quality, consistent style and visual continuity`;
    
    // 添加同步点信息
    if (shot.syncPoint) {
      videoPrompt += `, sync with music: ${shot.syncPoint}`;
    }
    
    return videoPrompt;
  }
}

export default new VideoGeneratorAgent();

