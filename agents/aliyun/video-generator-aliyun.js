import fs from 'fs';
import path from 'path';
import config from '../../config/config.js';
import aliyunClient from '../../utils/aliyun-client.js';
import { batchConcurrent } from '../../utils/utils.js';

class VideoGeneratorAliyunAgent {
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
    // 必须使用 videoPrompt，如果没有则抛出错误
    if (!shot.videoPrompt) {
      throw new Error(`镜头 ${shot.shotNumber} 缺少必需的 videoPrompt 字段`);
    }
    
    const duration = shot.endTime - shot.startTime;
    const beatPointsInRange = this._getBeatPointsInRange(shot, storyboard?.musicAnalysis);
    const rhythm = storyboard?.musicAnalysis?.rhythm;
    
    // 构建节拍同步描述
    const buildBeatSyncDescription = () => {
      if (beatPointsInRange.length > 0) {
        const relativeBeatTimes = beatPointsInRange.map(beat => ({
          absolute: beat,
          relative: beat - shot.startTime
        }));
        const beatTimesAbsolute = relativeBeatTimes.map(b => `${b.absolute.toFixed(2)}秒`).join(', ');
        const beatTimesRelative = relativeBeatTimes.map(b => `${b.relative.toFixed(2)}秒`).join(', ');
        return [
          `此片段中的节拍点 (音乐时间): ${beatTimesAbsolute}`,
          `相对于片段开始的节拍点: ${beatTimesRelative}`,
          `在这些节拍点 (${beatTimesRelative})，动作或镜头运动必须强调或改变以匹配音乐节奏`,
          `运动应该在这些精确时刻加速、改变方向或产生视觉强调，以与音乐节拍同步`,
          `视觉节奏必须匹配音乐节奏 - 动作峰值应与节拍点对齐`
        ];
      } else if (shot.beatPoint != null) {
        const relativeBeatTime = shot.beatPoint - shot.startTime;
        return [
          `节拍点在此片段 ${relativeBeatTime.toFixed(2)}秒处 (音乐时间: ${shot.beatPoint.toFixed(2)}秒)`,
          `在此节拍点 (${relativeBeatTime.toFixed(2)}秒)，强调动作或改变镜头运动以与音乐节拍同步`
        ];
      }
      return [];
    };
    
    const parts = [
      // 使用提供的 videoPrompt 作为基础（描述动态动作）
      shot.videoPrompt,
      
      // 添加首尾帧过渡信息
      `从关键帧 A 到关键帧 B 生成视频:`,
      `起始关键帧 A (镜头 ${shot.shotNumber} 开始)`,
      keyframeB.nextShotNumber 
        ? `平滑过渡到关键帧 B (镜头 ${keyframeB.nextShotNumber} 开始)`
        : `平滑过渡到关键帧 B (镜头 ${shot.shotNumber} 结束)`,
      
      // 时间和同步
      `时长: ${duration} 秒`,
      `时间范围: ${shot.timeRange} (音乐时间: ${shot.startTime.toFixed(2)}秒 - ${shot.endTime.toFixed(2)}秒)`,
      `重要提示: 此视频片段对应音乐时间 ${shot.startTime.toFixed(2)}秒 - ${shot.endTime.toFixed(2)}秒`,
      `视频动作、运动和节奏必须与音乐节拍和节奏同步`,
      
      // 节拍同步描述
      ...buildBeatSyncDescription(),
      
      // 同步点
      shot.syncPoint && `同步点: ${shot.syncPoint}`,
      
      // 音乐节奏信息
      rhythm?.bpm && `音乐 BPM: ${rhythm.bpm} - 视频运动节奏应匹配此节拍率`,
      rhythm?.bpm && `节拍间隔: ${(60 / rhythm.bpm).toFixed(2)} 秒 - 运动应遵循此节奏`,
      rhythm?.character && `音乐节奏特征: ${rhythm.character} - 视频运动应反映此节奏风格`,
      
      // Cocomelon 风格
      `视觉风格: Cocomelon 动画风格 - 明亮鲜艳的色彩，简单可爱的角色设计，流畅的 3D 动画，适合儿童的视觉风格，圆润友好的角色，清晰的线条，简单的背景，教育性和娱乐性结合，活泼欢快的氛围`,
      `平滑运动从关键帧 A 到关键帧 B，Cocomelon 风格，高质量，一致的风格和视觉连续性`,
      `整个片段中视频运动节奏必须匹配音乐节奏`
    ].filter(Boolean);

    return parts.join('，');
  }

  // 生成单个视频
  async _generateVideo(material, keyframeData) {
    const { shot, keyframeA, keyframeB } = material;
    
    console.log(`  🎬 镜头 ${shot.shotNumber}: ${shot.timeRange}秒`);
    
    // 打印卡点信息
    const beatPointsInRange = this._getBeatPointsInRange(shot, keyframeData.storyboard?.musicAnalysis);
    if (beatPointsInRange.length > 0) {
      const relativeTimes = beatPointsInRange.map(b => `${(b - shot.startTime).toFixed(2)}秒`).join(', ');
      console.log(`    🎵 卡点: ${beatPointsInRange.map(b => `${b.toFixed(2)}秒`).join(', ')} (相对时间: ${relativeTimes})`);
    } else if (shot.beatPoint != null) {
      const relativeTime = shot.beatPoint - shot.startTime;
      console.log(`    🎵 卡点: ${shot.beatPoint.toFixed(2)}秒 (相对时间: ${relativeTime.toFixed(2)}秒)`);
    }
    
    try {
      // 检查关键帧文件是否存在
      if (!keyframeA?.path || !fs.existsSync(keyframeA.path)) {
        throw new Error(`关键帧 A 不存在: ${keyframeA?.path}`);
      }
      
      if (!keyframeB?.path || !fs.existsSync(keyframeB.path)) {
        throw new Error(`关键帧 B 不存在: ${keyframeB?.path}`);
      }
      
      const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
      const videoPrompt = this._buildPrompt(shot, keyframeA, keyframeB, keyframeData.storyboard);
      
      // 打印完整提示词
      console.log(`\n    📝 完整提示词:`);
      console.log(`    ${videoPrompt}\n`);
      
      // 计算视频时长（秒）
      const duration = shot.endTime - shot.startTime;
      
      // 调用阿里万象 API 生成视频
      await aliyunClient.generateVideo(
        keyframeA.path,
        keyframeB.path,
        videoPrompt,
        videoPath,
        {
          resolution: '720P', // 可以根据需要调整
          prompt_extend: true,
        }
      );
      
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
    console.log('🎬 Agent 6: 视频生成器（阿里万象）- 开始生成...');
    
    try {
      const keyframes = keyframeData.keyframes || [];
      console.log(`🎬 基于 AB 关键帧生成 ${keyframes.length} 个视频片段（使用阿里万象 wanx2.1-kf2v-plus 模型）...\n`);
      
      const materials = keyframes.map(kf => this._createMaterial(kf));
      
      // 使用并发控制工具函数
      await batchConcurrent(materials, 
        material => this._generateVideo(material, keyframeData),
        {
          concurrency: 3, // 阿里万象 API 可能有限流，降低并发数
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

export default new VideoGeneratorAliyunAgent();

