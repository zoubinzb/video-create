import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';
import { batchConcurrent } from '../utils/utils.js';

const VIDEO_STYLE = 'smooth motion from keyframe A to keyframe B, cinematic, high quality, consistent style and visual continuity';

class VideoGeneratorAgent {
  // 创建素材数据结构
  _createMaterial(keyframe) {
    const { shot, keyframeA, keyframeB } = keyframe;
    return {
      shotNumber: shot.shotNumber,
      timeRange: shot.timeRange,
      startTime: shot.startTime,
      endTime: shot.endTime,
      type: 'video',
      path: null,
      status: 'pending',
      shot,
      keyframeA,
      keyframeB
    };
  }

  // 构建视频提示词
  _buildPrompt(shot, keyframeA, keyframeB, storyboard) {
    const parts = [
      `Generate video from keyframe A to keyframe B:`,
      `Start from keyframe A (shot ${shot.shotNumber} start): ${keyframeA.prompt}`,
      keyframeB.nextShotNumber 
        ? `transition smoothly to keyframe B (shot ${keyframeB.nextShotNumber} start): ${keyframeB.prompt}`
        : `transition smoothly to keyframe B (shot ${shot.shotNumber} end): ${keyframeB.prompt}`
    ];

    const fields = [
      ['composition', shot.composition],
      ['framing', shot.framing],
      ['lighting', shot.lighting],
      ['camera movement', shot.movement !== '静止' ? shot.movement : null],
      ['action', shot.action],
      ['transition', shot.transition?.type ? `${shot.transition.type}${shot.transition.duration ? ` (${shot.transition.duration}s)` : ''}` : null]
    ];

    fields.forEach(([key, value]) => {
      if (value) parts.push(`${key}: ${value}`);
    });

    const duration = shot.endTime - shot.startTime;
    parts.push(`duration: ${duration} seconds`);
    parts.push(`time range: ${shot.timeRange}`);

    if (shot.beatPoint != null) parts.push(`beat point at ${shot.beatPoint}s`);
    if (shot.syncPoint) parts.push(`sync with music: ${shot.syncPoint}`);

    const concept = storyboard?.visualConcept?.visualConcept;
    if (concept?.style?.name) parts.push(`style: ${concept.style.name}`);
    if (concept?.colorPalette?.primary) parts.push(`color palette: ${concept.colorPalette.primary.join(', ')}`);
    if (shot.prompt) parts.push(`shot prompt: ${shot.prompt}`);

    parts.push(VIDEO_STYLE);

    return parts.join(', ');
  }

  // 准备关键帧图像路径
  _prepareReferenceImages(keyframeA, keyframeB) {
    const images = [];
    if (keyframeA?.path && fs.existsSync(keyframeA.path)) {
      images.push(keyframeA.path);
    }
    if (keyframeB?.path && fs.existsSync(keyframeB.path)) {
      images.push(keyframeB.path);
    }
    return images;
  }

  // 生成单个视频
  async _generateVideo(material, keyframeData) {
    const { shot, keyframeA, keyframeB } = material;
    
    console.log(`  🎬 镜头 ${shot.shotNumber}: ${shot.timeRange}秒`);
    
    try {
      const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
      const videoPrompt = this._buildPrompt(shot, keyframeA, keyframeB, keyframeData.storyboard);
      const referenceImages = this._prepareReferenceImages(keyframeA, keyframeB);
      
      await geminiClient.generateVideo(videoPrompt, videoPath, 'veo-3.1-generate-preview', referenceImages);
      
      material.path = videoPath;
      material.status = 'generated';
      material.prompt = videoPrompt;
      console.log(`    ✅ 生成完成`);
    } catch (error) {
      console.error(`    ❌ 生成失败: ${error.message}`);
      material.status = 'failed';
      material.error = error.message;
      
      // 使用关键帧 A 作为后备
      if (keyframeA?.path) {
        material.path = keyframeA.path;
        material.type = 'image';
        material.status = 'keyframe_fallback';
        console.log(`    ⚠️  使用关键帧作为后备`);
      }
    }
  }

  // 基于 AB 关键帧生成视频
  async generate(keyframeData) {
    console.log('🎬 Agent 5: 视频生成器 - 开始生成...');
    
    try {
      const keyframes = keyframeData.keyframes || [];
      console.log(`🎬 基于 AB 关键帧生成 ${keyframes.length} 个视频片段...\n`);
      
      const materials = keyframes.map(kf => this._createMaterial(kf));
      
      // 使用并发控制工具函数
      await batchConcurrent(materials, 
        material => this._generateVideo(material, keyframeData),
        {
          concurrency: 5,
          startIndex: 0,
          onBatchStart: (batch, batchNum, total) => {
            console.log(`\n📦 批次 ${batchNum}/${total}: 镜头 ${batch[0].shotNumber}-${batch[batch.length - 1].shotNumber}`);
          },
          onBatchComplete: (batch, batchNum, total) => {
            const success = batch.filter(m => m.status === 'generated').length;
            console.log(`  ✅ 批次完成: ${success}/${batch.length} 个视频\n`);
          }
        }
      );

      const successCount = materials.filter(m => m.status === 'generated').length;
      console.log(`✅ 视频生成完成: ${successCount}/${materials.length} 个视频\n`);
      
      return {
        keyframeData,
        materials,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 视频生成失败:', error);
      throw error;
    }
  }
}

export default new VideoGeneratorAgent();

