import fs from 'fs';
import path from 'path';
import config from '../../config/config.js';
import geminiClient from '../../utils/gemini-client.js';
import { batchConcurrent } from '../../utils/utils.js';
import characterLibrary from '../../utils/character-library.js';

const VIDEO_STYLE = 'Cocomelon style: bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere, smooth motion from keyframe, high quality, consistent style and visual continuity';

class VideoGeneratorImageToVideoAgent {
  // 创建素材数据结构
  _createMaterial(keyframe) {
    const { shot, keyframeA } = keyframe;
    return {
      shotNumber: shot.shotNumber,
      timeRange: shot.timeRange,
      startTime: shot.startTime,
      endTime: shot.endTime,
      type: 'video',
      path: null,
      status: 'pending',
      shot,
      keyframeA
    };
  }

  // 获取镜头时间段内的所有卡点
  _getBeatPointsInRange(shot, musicAnalysis) {
    const beatPoints = musicAnalysis?.beatPoints || [];
    const shotStart = shot.startTime;
    const shotEnd = shot.endTime;
    
    return beatPoints.filter(beat => beat >= shotStart && beat < shotEnd);
  }

  // 为镜头选择角色
  _selectCharacterForShot(shot, storyboard) {
    // 如果 shot 中已经有角色信息，使用它
    if (shot.characterName) {
      const character = characterLibrary.getCharacterByName(shot.characterName);
      if (character) {
        return character;
      }
    }
    
    // 根据场景描述智能选择角色
    const sceneDescription = shot.videoPrompt || shot.action || '';
    return characterLibrary.selectCharacterForScene(sceneDescription, shot.shotNumber);
  }

  // 构建视频提示词（图生视频模式）
  _buildPrompt(shot, keyframeA, storyboard) {
    const duration = shot.endTime - shot.startTime;
    const beatPointsInRange = this._getBeatPointsInRange(shot, storyboard?.musicAnalysis);
    const rhythm = storyboard?.musicAnalysis?.rhythm;
    const concept = storyboard?.visualConcept?.visualConcept;
    
    // 选择角色
    const character = this._selectCharacterForShot(shot, storyboard);
    
    // 构建节拍同步描述
    const buildBeatSyncDescription = () => {
      if (beatPointsInRange.length > 0) {
        const relativeBeatTimes = beatPointsInRange.map(beat => ({
          absolute: beat,
          relative: beat - shot.startTime
        }));
        const beatTimesAbsolute = relativeBeatTimes.map(b => `${b.absolute.toFixed(2)}s`).join(', ');
        const beatTimesRelative = relativeBeatTimes.map(b => `${b.relative.toFixed(2)}s`).join(', ');
        return [
          `Beat points in this segment (at music time): ${beatTimesAbsolute}`,
          `Beat points relative to segment start: ${beatTimesRelative}`,
          `At these beat points (${beatTimesRelative}), the action or camera movement MUST emphasize or change to match the music rhythm`,
          `The motion should accelerate, change direction, or create visual emphasis at these exact moments to sync with the music beats`,
          `Visual rhythm must match musical rhythm - action peaks should align with beat points`
        ];
      } else if (shot.beatPoint != null) {
        const relativeBeatTime = shot.beatPoint - shot.startTime;
        return [
          `Beat point at ${relativeBeatTime.toFixed(2)}s into this segment (music time: ${shot.beatPoint.toFixed(2)}s)`,
          `At this beat point (${relativeBeatTime.toFixed(2)}s), emphasize the action or change camera movement to sync with the music beat`
        ];
      }
      return [];
    };

    // 必须使用 videoPrompt，如果没有则抛出错误
    if (!shot.videoPrompt) {
      throw new Error(`镜头 ${shot.shotNumber} 缺少必需的 videoPrompt 字段`);
    }
    
    const parts = [
      // 使用提供的 videoPrompt 作为基础（描述动态动作）
      shot.videoPrompt,
      
      // 添加角色信息 - 严格禁止修改角色外观
      `CRITICAL CHARACTER CONSISTENCY: The character in this video must be "${character.name}". Character description: ${character.desc}`,
      `REFERENCE IMAGES PROVIDED:`,
      `- Keyframe image: Shows the scene and character in the initial state`,
      `- Character reference image: Shows the exact character design from the character library (${character.name})`,
      `- You MUST use BOTH reference images to ensure character consistency`,
      `- The character reference image shows the EXACT character design you must use - this is the authoritative source for character appearance`,
      `ABSOLUTELY FORBIDDEN during animation:`,
      `- DO NOT add, remove, or modify ANY character features (hair, accessories, clothing, backpacks, etc.)`,
      `- DO NOT change the character's colors, proportions, design elements, or visual details`,
      `- DO NOT modify facial features, body shape, or any appearance aspects`,
      `- DO NOT deviate from the character reference image in ANY way`,
      `MANDATORY REQUIREMENTS:`,
      `- The character's appearance must match the character reference image EXACTLY`,
      `- Use the character reference image as the authoritative source for character design`,
      `- The character's appearance, design, colors, accessories, clothing, and ALL details must remain EXACTLY the same as shown in the character reference image throughout the entire video`,
      `- Maintain the exact same character size, proportions, and visual appearance from start to end`,
      `- The character must look identical to the character reference image in every frame`,
      `- Copy the character design from the character reference image pixel-perfectly and maintain it throughout the animation`,
      
      // 场景大小一致性
      `CRITICAL SCENE CONSISTENCY:`,
      `- Maintain the exact same scene scale, character size, and composition throughout the entire video`,
      `- The character's size relative to the scene must remain constant from start to end`,
      `- Keep the same camera distance and framing as shown in the keyframe image`,
      `- Do not zoom in or out - maintain consistent scene proportions`,
      `- The background and scene elements must maintain the same scale throughout`,
      
      // 添加必要的补充信息
      `Generate video from keyframe image`,
      `Animate the scene smoothly based on the keyframe image`,
      `Maintain visual consistency: character appearance, scene scale, and composition must remain constant`,
      
      // 时间和同步
      `duration: ${duration} seconds`,
      `time range: ${shot.timeRange} (music time: ${shot.startTime.toFixed(2)}s - ${shot.endTime.toFixed(2)}s)`,
      `CRITICAL: This video segment corresponds to music time ${shot.startTime.toFixed(2)}s - ${shot.endTime.toFixed(2)}s`,
      `The video motion, action, and rhythm MUST sync with the music beat and rhythm`,
      
      // 节拍同步描述
      ...buildBeatSyncDescription(),
      
      // 同步点
      shot.syncPoint && `Sync point: ${shot.syncPoint}`,
      
      // 音乐节奏信息
      rhythm?.bpm && `Music BPM: ${rhythm.bpm} - video motion tempo should match this beat rate`,
      rhythm?.bpm && `Beat interval: ${(60 / rhythm.bpm).toFixed(2)} seconds - motion should follow this rhythm`,
      rhythm?.character && `Music rhythm character: ${rhythm.character} - video motion should reflect this rhythm style`,
      
      // Cocomelon 风格
      VIDEO_STYLE,
      `The video motion rhythm must match the music rhythm throughout the entire segment`,
      `Animate the keyframe image smoothly, bringing the scene to life with natural motion that matches the music rhythm`
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  // 准备参考图像（关键帧 + 角色库参考图片）
  _prepareReferenceImages(keyframeA, shot, storyboard) {
    const referenceImages = [];
    
    // 1. 添加关键帧图像（首帧）
    if (keyframeA?.path && fs.existsSync(keyframeA.path)) {
      referenceImages.push(keyframeA.path);
    }
    
    // 2. 添加角色库中的角色参考图片
    const character = this._selectCharacterForShot(shot, storyboard);
    const characterImagePath = characterLibrary.getCharacterImagePath(character.name);
    
    if (characterImagePath && fs.existsSync(characterImagePath)) {
      referenceImages.push(characterImagePath);
      console.log(`    🎭 添加角色参考图片: ${character.name} (${path.basename(characterImagePath)})`);
    } else {
      console.warn(`    ⚠️  角色 "${character.name}" 的图片不存在: ${characterImagePath}`);
    }
    
    return referenceImages;
  }

  // 生成单个视频（图生视频模式）
  async _generateVideo(material, keyframeData) {
    const { shot, keyframeA } = material;
    
    console.log(`  🎬 镜头 ${shot.shotNumber}: ${shot.timeRange}秒 (图生视频模式)`);
    
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
      // 检查关键帧文件是否存在
      if (!keyframeA?.path || !fs.existsSync(keyframeA.path)) {
        throw new Error(`关键帧不存在: ${keyframeA?.path}`);
      }
      
      const videoPath = path.join(config.paths.temp, `shot_${shot.shotNumber}.mp4`);
      const videoPrompt = this._buildPrompt(shot, keyframeA, keyframeData.storyboard);
      
      // 打印完整提示词
      console.log(`\n    📝 完整提示词:`);
      console.log(`    ${videoPrompt}\n`);
      
      // 准备参考图像：关键帧 + 角色库参考图片
      const referenceImages = this._prepareReferenceImages(keyframeA, shot, keyframeData.storyboard);
      
      console.log(`    📸 使用 ${referenceImages.length} 个参考图片: 关键帧 + 角色参考图片`);
      
      // 调用 Gemini Veo 图生视频 API（传入关键帧和角色参考图片）
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

  // 基于首帧生成视频（图生视频模式）
  async generate(keyframeData) {
    console.log('🎬 Agent 5 (图生视频): 视频生成器 - 开始生成...');
    console.log('   模式: 使用首帧图像生成视频（Gemini Veo 图生视频模式）\n');
    
    try {
      const keyframes = keyframeData.keyframes || [];
      console.log(`🎬 基于首帧图像生成 ${keyframes.length} 个视频片段...\n`);
      
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

export default new VideoGeneratorImageToVideoAgent();

