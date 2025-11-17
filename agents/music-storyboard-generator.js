import geminiClient from '../utils/gemini-client.js';
import audioUtils from '../utils/audio-utils.js';
import path from 'path';

const SHOT_DURATION = 8.0; // 固定每个镜头8秒

/**
 * Agent 1: 音乐分析与分镜生成器
 * 分析音乐，生成视觉风格、颜色方案、视觉元素建议、故事板要求等
 * 返回 JSON 格式，包含音乐分析、视觉概念和故事板
 * {
 *   "musicAnalysis": {
 *     "emotion": {
 *       "primary": "primary emotion",
 *       "intensity": intensity score (number),
 *       "secondary": ["secondary emotion 1", "secondary emotion 2"]
 *     }
 *   }
 * }
 */
class MusicStoryboardGeneratorAgent {
  // 构建AI提示词
  _buildPrompt(videoDuration, lyricsText) {
    const shotsNeeded = Math.ceil(videoDuration / SHOT_DURATION);
    return `You are a professional music video producer. Please carefully listen to and analyze this music, then generate a complete storyboard directly.

${lyricsText ? `Lyrics:\n${lyricsText}\n\n` : ''}**Task Requirements:**
1. Analyze the music's emotion, rhythm, theme, structure, and climax
2. Identify beat points in the music (rhythm changes, beat accents, climax, etc.)
3. Generate visual style and color scheme based on music analysis
4. Generate a complete storyboard directly. The total video duration must be exactly ${videoDuration.toFixed(2)} seconds

**Music Analysis Requirements:**
Please analyze the following:
- Emotion Recognition: Primary emotion, intensity (0-10 scale), secondary emotions
- Rhythm Analysis: Estimated BPM, rhythm characteristics, time positions of rhythm changes (in seconds)
- Theme Extraction: Main theme, keyword list (at least 5 keywords)
- Structure Analysis: Identify verses, choruses, bridges, interludes, etc., and their time positions
- Climax Recognition: Time when climax occurs (in seconds), intensity (0-10 scale)
- **Beat Point Recognition (CRITICAL)**: 
  - Identify ALL important musical beat points throughout the entire song
  - Beat points include: beat accents (strong beats), rhythm changes, emotional transitions, melody changes, drum hits, etc.
  - Record the EXACT time position (in seconds, precise to 2 decimal places) for EACH beat point
  - These beat points will be used to synchronize video cuts and actions with the music rhythm
  - Example: If you hear a strong beat at 2.5 seconds, record it as 2.50 in the beatPoints array
  - The more beat points you identify, the better the video will sync with the music

**Visual Concept Requirements:**
Based on music analysis, generate:
- Visual Style: Specific visual style (e.g., cyberpunk, retro, minimalist, abstract, natural, cinematic, etc.)
- Color Scheme: Primary colors, secondary colors, color mood
- Visual Element Suggestions: Recommended visual elements (e.g., particles, light effects, abstract graphics, etc.)

**Storyboard Requirements:**
1. Total video duration must be exactly ${videoDuration.toFixed(2)} seconds
2. **Each shot is fixed at ${SHOT_DURATION} seconds** (the last shot may be less than ${SHOT_DURATION} seconds, based on total video duration)
3. Shot count calculation: ${shotsNeeded} shots are needed
4. **CRITICAL: Beat Point Integration**:
   - After identifying all beat points in musicAnalysis.beatPoints, you MUST use them when creating shots
   - For each shot, check which beat points fall within that shot's time range
   - If a beat point falls within a shot's time range, set that shot's "beatPoint" field to the beat point's time (in seconds)
   - The "syncPoint" field should describe how the shot syncs with music, referencing the beat points
   - Example: If shot 1 is 0.00-8.00s and beat points are at 2.5s, 4.0s, 6.5s, then shot 1's beatPoint should be set to one of these (preferably the first or most prominent), and syncPoint should mention "syncs with beats at 2.5s, 4.0s, 6.5s"
   - The action and camera movement should be designed to emphasize or change at these beat points
5. Each shot must include:
   - Timecode (precise to 2 decimal places, each shot fixed at ${SHOT_DURATION} seconds, format: 0.00-${SHOT_DURATION}.00, ${SHOT_DURATION}.00-${SHOT_DURATION * 2}.00, ...)
   - Framing (wide shot/medium shot/close-up/extreme close-up)
   - Composition description
   - Lighting description (cool tone/warm tone/high contrast, etc.)
   - Camera movement (push/pull/pan/track/static)
   - Action description (should be designed to sync with beat points in this shot)
   - Sync point with music (must explicitly mention beat point positions and how the shot syncs with them)
   - beatPoint: The time (in seconds) of the most prominent beat point within this shot's time range (if any)
   - Transition type (fade in/fade out/cut/wipe, etc.)
   - Detailed prompt for image/video generation (should mention beat synchronization)
6. **Key Requirements**:
   - Each shot must be strictly fixed at ${SHOT_DURATION} seconds (except the last shot)
   - The last shot's end time must be exactly ${videoDuration.toFixed(2)} seconds
   - Visual style and colors must be consistent with music emotion and theme
   - **Each shot MUST reference the beat points within its time range in the syncPoint and beatPoint fields**

Please return in JSON format, ensuring correct format:
{
  "musicAnalysis": {
    "emotion": {
      "primary": "primary emotion",
      "intensity": intensity score (number),
      "secondary": ["secondary emotion 1", "secondary emotion 2"]
    },
    "rhythm": {
      "bpm": BPM value (number),
      "character": "rhythm characteristics description",
      "changes": [time positions of rhythm changes (seconds, numbers)],
      "beats": [time positions of beat accents (seconds, numbers)]
    },
    "theme": {
      "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"],
      "mainTheme": "main theme"
    },
    "structure": [
      {
        "type": "section type (verse/chorus/bridge/interlude)",
        "startTime": start time (seconds, number),
        "endTime": end time (seconds, number),
        "description": "section description"
      }
    ],
    "climax": {
      "time": climax time (seconds, number),
      "intensity": intensity (number)
    },
    "beatPoints": [time positions of ALL beat points throughout the entire song (seconds, numbers, precise to 2 decimal places). 
      IMPORTANT: List EVERY beat point you identify, including:
      - Strong beat accents (every 0.5-2 seconds depending on tempo)
      - Rhythm changes
      - Melody changes  
      - Emotional transitions
      - Drum hits or percussion accents
      - Any moment where the music has a noticeable emphasis or change
      Example format: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, ...] - list all beat points from 0 to ${videoDuration.toFixed(2)} seconds]
  },
  "visualConcept": {
    "style": {
      "name": "style name",
      "description": "detailed style description",
      "references": "style reference notes"
    },
    "colorPalette": {
      "primary": ["primary color 1", "primary color 2"],
      "secondary": ["secondary color 1", "secondary color 2"],
      "mood": "color mood description"
    },
    "visualElements": ["recommended element 1", "recommended element 2"]
  },
  "storyboard": {
    "shots": [
      {
        "shotNumber": shot number (number),
        "timeRange": "0.00-${SHOT_DURATION}.00" (each shot fixed at ${SHOT_DURATION} seconds, format: 0.00-${SHOT_DURATION}.00, ${SHOT_DURATION}.00-${SHOT_DURATION * 2}.00...),
        "startTime": 0.00 (number, precise to 2 decimal places, each shot spaced ${SHOT_DURATION} seconds apart),
        "endTime": ${SHOT_DURATION}.00 (number, precise to 2 decimal places, each shot fixed at ${SHOT_DURATION} seconds, except the last shot),
        "framing": "framing (wide shot/medium shot/close-up/extreme close-up)",
        "composition": "composition description",
        "lighting": "lighting description (cool tone/warm tone/high contrast, etc.)",
        "movement": "camera movement (push/pull/pan/track/static)",
        "action": "action description (should be designed to sync with beat points in this shot)",
        "syncPoint": "sync point description with music - MUST explicitly mention which beat points (from musicAnalysis.beatPoints) fall within this shot's time range and how the shot syncs with them. Example: 'Syncs with beats at 2.5s, 4.0s, 6.5s - action emphasizes at these moments'",
        "beatPoint": the time (in seconds) of the most prominent beat point within this shot's time range, taken from musicAnalysis.beatPoints. If multiple beat points exist in this shot, choose the most prominent one. If no beat point falls in this shot, set to null,
        "transition": {
          "type": "transition type (fade in/fade out/cut/wipe, etc.)",
          "duration": transition duration (seconds, number)
        },
        "prompt": "detailed prompt for image/video generation"
      }
    ],
    "totalDuration": ${videoDuration.toFixed(2)} (number, must be exactly equal to audio duration),
    "notes": "storyboard notes and considerations"
  }
}`;
  }

  // 解析JSON结果
  _parseResult(result) {
    if (result.raw) {
      try {
        return typeof result.raw === 'string' ? JSON.parse(result.raw) : result.raw;
      } catch (e) {
        const jsonMatch = result.raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error('无法解析 JSON 结果');
      }
    }
    return result;
  }

  // 创建镜头对象
  _createShot(index, videoDuration, originalShot = {}) {
    const startTime = index * SHOT_DURATION;
    const isLastShot = startTime + SHOT_DURATION >= videoDuration;
    const endTime = isLastShot ? videoDuration : startTime + SHOT_DURATION;

    return {
      shotNumber: index + 1,
      timeRange: `${startTime.toFixed(2)}-${endTime.toFixed(2)}`,
      startTime,
      endTime,
      framing: originalShot.framing,
      composition: originalShot.composition,
      lighting: originalShot.lighting,
      movement: originalShot.movement,
      action: originalShot.action ,
      syncPoint: originalShot.syncPoint,
      beatPoint: originalShot.beatPoint,
      transition: originalShot.transition,
      prompt: originalShot.prompt
    };
  }

  // 修正分镜脚本时间
  _correctShotTimings(storyboard, videoDuration) {
    if (!storyboard?.shots) return;

    const requiredShots = Math.ceil(videoDuration / SHOT_DURATION);
    const shots = storyboard.shots;

    if (shots.length !== requiredShots) {
      console.log(`   ⚠️  镜头数量不匹配（生成${shots.length}个，需要${requiredShots}个），正在修正...`);
      storyboard.shots = Array.from({ length: requiredShots }, (_, i) =>
        this._createShot(i, videoDuration, shots[i])
      );
    } else {
      shots.forEach((shot, i) => Object.assign(shot, this._createShot(i, videoDuration, shot)));
    }

    storyboard.totalDuration = videoDuration;
  }

  // 生成分镜脚本
  async generate(audioPath, lyricsText = null) {
    console.log('🎬 Agent 1: 音乐分析与分镜生成器 - 开始生成...');

    try {
      // 获取音频时长
      const audioInfo = await audioUtils.getAudioInfo(audioPath).catch(() => ({ duration: 30 }));
      const videoDuration = audioInfo.duration || 30;
      console.log(`   📊 音频时长: ${videoDuration.toFixed(2)} 秒`);

      const prompt = this._buildPrompt(videoDuration, lyricsText);

      // 尝试音频分析，失败则回退到文本分析
      let result;
      try {
        result = await geminiClient.generateJSONWithAudio(prompt, audioPath);
      } catch (error) {
        console.warn('   ⚠️  音频分析失败，使用文本模式');
        const fileName = path.basename(audioPath, path.extname(audioPath));
        const fallbackPrompt = `You are a professional music video producer. Please analyze the following music and generate a storyboard:\n\n${lyricsText ? `Lyrics:\n${lyricsText}\n\n` : ''}Filename: ${fileName}\n\n${prompt}`;
        result = await geminiClient.generateJSON(fallbackPrompt);
      }

      const parsedResult = this._parseResult(result);
      this._correctShotTimings(parsedResult.storyboard, videoDuration);

      // 获取音频详细信息（可选）
      const [audioInfoDetail, bpmInfo] = await Promise.allSettled([
        audioUtils.getAudioInfo(audioPath),
        audioUtils.detectBPM(audioPath)
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

      console.log(`   ✅ 生成完成：${parsedResult.storyboard?.shots?.length || 0} 个镜头\n`);

      return {
        audioInfo: audioInfoDetail || { duration: videoDuration, note: '未获取音频技术信息' },
        bpmInfo: bpmInfo || { note: '未检测BPM' },
        musicAnalysis: parsedResult.musicAnalysis,
        visualConcept: parsedResult.visualConcept,
        storyboard: parsedResult.storyboard,
        timestamp: new Date().toISOString(),
        analysisMethod: 'gemini-direct'
      };
    } catch (error) {
      console.error('❌ 音乐分析与分镜生成失败:', error);
      throw error;
    }
  }
}

export default new MusicStoryboardGeneratorAgent();

