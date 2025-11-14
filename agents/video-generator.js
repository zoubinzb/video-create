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
      
      // 准备所有材料对象
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
          shot: shot, // 保存 shot 信息
          keyframeA: keyframeA,
          keyframeB: keyframeB,
        };
        
        materials.push(material);
      }
      
      // 分批并发生成，每批5个
      const CONCURRENT_LIMIT = 5;
      const totalShots = materials.length;
      
      for (let batchStart = 0; batchStart < totalShots; batchStart += CONCURRENT_LIMIT) {
        const batchEnd = Math.min(batchStart + CONCURRENT_LIMIT, totalShots);
        const batch = materials.slice(batchStart, batchEnd);
        const batchNumber = Math.floor(batchStart / CONCURRENT_LIMIT) + 1;
        const totalBatches = Math.ceil(totalShots / CONCURRENT_LIMIT);
        
        console.log(`\n📦 批次 ${batchNumber}/${totalBatches}: 并发生成 ${batch.length} 个视频片段 (镜头 ${batch[0].shotNumber} - ${batch[batch.length - 1].shotNumber})`);
        
        // 并发执行当前批次的所有任务
        const batchPromises = batch.map(material => this.generateSingleVideo(material, keyframeData, keyframes.length));
        
        await Promise.all(batchPromises);
        
        const batchSuccessCount = batch.filter(m => m.status === 'generated').length;
        console.log(`\n✅ 批次 ${batchNumber} 完成: ${batchSuccessCount}/${batch.length} 个视频成功生成`);
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
   * 生成单个视频
   */
  async generateSingleVideo(material, keyframeData, totalShots) {
    const shot = material.shot;
    const keyframeA = material.keyframeA;
    const keyframeB = material.keyframeB;
    
    console.log(`\n  🎬 镜头 ${shot.shotNumber}/${totalShots}: ${shot.timeRange}秒`);
    console.log(`     关键帧 A: ${keyframeA.url}`);
    console.log(`     关键帧 B: ${keyframeB.url}`);
    
    // 打印切片信息用于检查
    console.log(`\n     📋 切片信息:`);
    console.log(`        - shotNumber: ${shot.shotNumber}`);
    console.log(`        - timeRange: ${shot.timeRange}`);
    console.log(`        - startTime: ${shot.startTime}`);
    console.log(`        - endTime: ${shot.endTime}`);
    console.log(`        - framing: ${shot.framing || '未设置'}`);
    console.log(`        - composition: ${shot.composition || '未设置'}`);
    console.log(`        - lighting: ${shot.lighting || '未设置'}`);
    console.log(`        - movement: ${shot.movement || '未设置'}`);
    console.log(`        - action: ${shot.action || '未设置'}`);
    console.log(`        - syncPoint: ${shot.syncPoint || '未设置'}`);
    console.log(`        - beatPoint: ${shot.beatPoint || '未设置'}`);
    console.log(`        - transition: ${shot.transition ? JSON.stringify(shot.transition) : '未设置'}`);
    console.log(`        - prompt: ${shot.prompt ? shot.prompt.substring(0, 100) + '...' : '未设置'}`);
    
    try {
      // 生成视频文件路径
      const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
      
      // 构建基于 AB 关键帧的视频提示词
      const videoPrompt = this.buildVideoPromptFromABKeyframes(shot, keyframeA, keyframeB, keyframeData);
      
      // 完整打印提示词
      console.log(`\n     📝 完整提示词:`);
      console.log(`     ${videoPrompt}`);
      console.log(`\n     📊 提示词长度: ${videoPrompt.length} 字符`);
      
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
    
    // 添加切片中的构图信息
    if (shot.composition) {
      videoPrompt += `, composition: ${shot.composition}`;
    }
    
    // 添加切片中的景别信息
    if (shot.framing) {
      videoPrompt += `, framing: ${shot.framing}`;
    }
    
    // 添加切片中的光线信息
    if (shot.lighting) {
      videoPrompt += `, lighting: ${shot.lighting}`;
    }
    
    // 添加切片中的镜头运动信息
    if (shot.movement && shot.movement !== '静止') {
      videoPrompt += `, camera movement: ${shot.movement}`;
    }
    
    // 添加切片中的画面动作信息
    if (shot.action) {
      videoPrompt += `, action: ${shot.action}`;
    }
    
    // 添加切片中的转场信息
    if (shot.transition && shot.transition.type) {
      videoPrompt += `, transition: ${shot.transition.type}`;
      if (shot.transition.duration) {
        videoPrompt += ` (${shot.transition.duration}s)`;
      }
    }
    
    // 添加时间信息
    const duration = shot.endTime - shot.startTime;
    videoPrompt += `, duration: ${duration} seconds`;
    videoPrompt += `, time range: ${shot.timeRange}`;
    
    // 添加切片中的卡点信息
    if (shot.beatPoint !== undefined && shot.beatPoint !== null) {
      videoPrompt += `, beat point at ${shot.beatPoint}s`;
    }
    
    // 添加同步点信息
    if (shot.syncPoint) {
      videoPrompt += `, sync with music: ${shot.syncPoint}`;
    }
    
    // 添加风格信息（从 storyboard 中获取）
    const storyboard = keyframeData.storyboard;
    if (storyboard?.visualConcept?.visualConcept) {
      const concept = storyboard.visualConcept.visualConcept;
      if (concept?.style?.name) {
        videoPrompt += `, style: ${concept.style.name}`;
      }
      if (concept?.colorPalette?.primary) {
        videoPrompt += `, color palette: ${concept.colorPalette.primary.join(', ')}`;
      }
    }
    
    // 如果切片中有自定义提示词，也添加进去
    if (shot.prompt) {
      videoPrompt += `, shot prompt: ${shot.prompt}`;
    }
    
    // 确保视频连贯性
    videoPrompt += `, smooth motion from keyframe A to keyframe B, cinematic, high quality, consistent style and visual continuity`;
    
    return videoPrompt;
  }
}

export default new VideoGeneratorAgent();

