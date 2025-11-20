import fs from 'fs';
import path from 'path';
import config from '../../config/config.js';
import geminiClient from '../../utils/gemini-client.js';
import { batchConcurrent } from '../../utils/utils.js';

const VIDEO_STYLE = 'Cocomelon style: bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere, smooth motion from keyframe A to keyframe B, high quality, consistent style and visual continuity';

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

  // 获取镜头时间段内的所有卡点
  _getBeatPointsInRange(shot, musicAnalysis) {
    const beatPoints = musicAnalysis?.beatPoints || [];
    const shotStart = shot.startTime;
    const shotEnd = shot.endTime;
    
    return beatPoints.filter(beat => beat >= shotStart && beat < shotEnd);
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
    parts.push(`time range: ${shot.timeRange} (music time: ${shot.startTime.toFixed(2)}s - ${shot.endTime.toFixed(2)}s)`);

    // 获取这个镜头时间段内的所有卡点
    const beatPointsInRange = this._getBeatPointsInRange(shot, storyboard?.musicAnalysis);
    
    // 强调音乐律动同步
    parts.push(`CRITICAL: This video segment corresponds to music time ${shot.startTime.toFixed(2)}s - ${shot.endTime.toFixed(2)}s.`);
    parts.push(`The video motion, action, and rhythm MUST sync with the music beat and rhythm.`);
    
    if (beatPointsInRange.length > 0) {
      // 计算相对时间（相对于镜头开始时间）
      const relativeBeatTimes = beatPointsInRange.map(beat => {
        const relativeTime = beat - shot.startTime;
        return { absolute: beat, relative: relativeTime };
      });
      
      const beatTimesAbsolute = relativeBeatTimes.map(b => `${b.absolute.toFixed(2)}s`).join(', ');
      const beatTimesRelative = relativeBeatTimes.map(b => `${b.relative.toFixed(2)}s`).join(', ');
      
      parts.push(`Beat points in this segment (at music time): ${beatTimesAbsolute}`);
      parts.push(`Beat points relative to segment start: ${beatTimesRelative}`);
      parts.push(`At these beat points (${beatTimesRelative}), the action or camera movement MUST emphasize or change to match the music rhythm.`);
      parts.push(`The motion should accelerate, change direction, or create visual emphasis at these exact moments to sync with the music beats.`);
      parts.push(`Visual rhythm must match musical rhythm - action peaks should align with beat points.`);
    } else if (shot.beatPoint != null) {
      const relativeBeatTime = shot.beatPoint - shot.startTime;
      parts.push(`Beat point at ${relativeBeatTime.toFixed(2)}s into this segment (music time: ${shot.beatPoint.toFixed(2)}s)`);
      parts.push(`At this beat point (${relativeBeatTime.toFixed(2)}s), emphasize the action or change camera movement to sync with the music beat.`);
    }
    
    if (shot.syncPoint) {
      parts.push(`Sync point: ${shot.syncPoint}`);
    }

    // 添加音乐节奏信息
    const rhythm = storyboard?.musicAnalysis?.rhythm;
    if (rhythm) {
      if (rhythm.bpm) {
        parts.push(`Music BPM: ${rhythm.bpm} - video motion tempo should match this beat rate`);
        const beatInterval = 60 / rhythm.bpm;
        parts.push(`Beat interval: ${beatInterval.toFixed(2)} seconds - motion should follow this rhythm`);
      }
      if (rhythm.character) {
        parts.push(`Music rhythm character: ${rhythm.character} - video motion should reflect this rhythm style`);
      }
    }

    const concept = storyboard?.visualConcept?.visualConcept;
    if (concept?.style?.name) parts.push(`style: ${concept.style.name}`);
    if (concept?.colorPalette?.primary) parts.push(`color palette: ${concept.colorPalette.primary.join(', ')}`);
    if (shot.prompt) parts.push(`shot prompt: ${shot.prompt}`);

    // Cocomelon 风格要求
    parts.push(`Visual style: Cocomelon animation style - bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere`);
    parts.push(VIDEO_STYLE);
    parts.push(`The video motion rhythm must match the music rhythm throughout the entire segment.`);

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
    
    // 打印卡点信息
    const beatPointsInRange = this._getBeatPointsInRange(shot, keyframeData.storyboard?.musicAnalysis);
    if (beatPointsInRange.length > 0) {
      const relativeTimes = beatPointsInRange.map(b => `${(b - shot.startTime).toFixed(2)}s`).join(', ');
      console.log(`    🎵 卡点: ${beatPointsInRange.map(b => `${b.toFixed(2)}s`).join(', ')} (相对时间: ${relativeTimes})`);
    } else if (shot.beatPoint != null) {
      const relativeTime = shot.beatPoint - shot.startTime;
      console.log(`    🎵 卡点: ${shot.beatPoint.toFixed(2)}s (相对时间: ${relativeTime.toFixed(2)}s)`);
    }
    
    try {
      const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
      const videoPrompt = this._buildPrompt(shot, keyframeA, keyframeB, keyframeData.storyboard);
      
      // 打印完整提示词
      console.log(`\n    📝 完整提示词:`);
      console.log(`    ${videoPrompt}\n`);
      
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

