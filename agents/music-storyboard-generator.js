import geminiClient from '../utils/gemini-client.js';
import audioUtils from '../utils/audio-utils.js';
import fs from 'fs';
import path from 'path';

class MusicStoryboardGeneratorAgent {
  /**
   * 合并音乐分析、视觉概念生成和分镜脚本生成
   * 直接基于音乐生成分镜脚本，识别卡点，视频长度等于音乐长度
   */
  async generate(audioPath, lyricsText = null) {
    console.log('🎬 Agent 1: 音乐分析与分镜生成器 - 开始生成...');
    
    try {
      // 获取音频时长
      let audioInfo;
      try {
        audioInfo = await audioUtils.getAudioInfo(audioPath);
        console.log(`   📊 音频时长: ${audioInfo.duration.toFixed(2)} 秒`);
      } catch (error) {
        console.warn('   ⚠️  无法获取音频信息，使用默认值');
        audioInfo = { duration: 30 };
      }

      const videoDuration = audioInfo.duration || 30;
      
      // 构建综合提示词：音乐分析 + 视觉概念 + 分镜脚本
      let prompt = `You are a professional music video producer. Please carefully listen to and analyze this music, then generate a complete storyboard directly.

`;

      if (lyricsText) {
        prompt += `Lyrics:
${lyricsText}

`;
      }

      prompt += `**Task Requirements:**
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
- Beat Point Recognition: Identify all important musical beat points (beat accents, rhythm changes, emotional transitions, etc.) and their time positions

**Visual Concept Requirements:**
Based on music analysis, generate:
- Visual Style: Specific visual style (e.g., cyberpunk, retro, minimalist, abstract, natural, cinematic, etc.)
- Color Scheme: Primary colors, secondary colors, color mood
- Visual Element Suggestions: Recommended visual elements (e.g., particles, light effects, abstract graphics, etc.)

**Storyboard Requirements:**
1. Total video duration must be exactly ${videoDuration.toFixed(2)} seconds
2. **Each shot is fixed at 8 seconds** (the last shot may be less than 8 seconds, based on total video duration)
3. Shot count calculation: ${Math.ceil(videoDuration / 8)} shots are needed
4. Each shot must include:
   - Timecode (precise to 2 decimal places, each shot fixed at 8 seconds, format: 0.00-8.00, 8.00-16.00, ...)
   - Framing (wide shot/medium shot/close-up/extreme close-up)
   - Composition description
   - Lighting description (cool tone/warm tone/high contrast, etc.)
   - Camera movement (push/pull/pan/track/static)
   - Action description
   - Sync point with music (must mark beat point positions)
   - Transition type (fade in/fade out/cut/wipe, etc.)
   - Detailed prompt for image/video generation
5. **Key Requirements**:
   - Each shot must be strictly fixed at 8 seconds (except the last shot)
   - Shot 1: 0.00-8.00 seconds
   - Shot 2: 8.00-16.00 seconds
   - Shot 3: 16.00-24.00 seconds
   - ...and so on
   - The last shot's end time must be exactly ${videoDuration.toFixed(2)} seconds
   - Visual style and colors must be consistent with music emotion and theme

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
    "beatPoints": [time positions of all beat points (seconds, numbers)]
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
        "timeRange": "0.00-8.00" (each shot fixed at 8 seconds, format: 0.00-8.00, 8.00-16.00, 16.00-24.00...),
        "startTime": 0.00 (number, precise to 2 decimal places, each shot spaced 8 seconds apart),
        "endTime": 8.00 (number, precise to 2 decimal places, each shot fixed at 8 seconds, except the last shot),
        "framing": "framing (wide shot/medium shot/close-up/extreme close-up)",
        "composition": "composition description",
        "lighting": "lighting description (cool tone/warm tone/high contrast, etc.)",
        "movement": "camera movement (push/pull/pan/track/static)",
        "action": "action description",
        "syncPoint": "sync point description with music (must mark beat point)",
        "beatPoint": beat point time (seconds, number, if any),
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

      // 尝试使用 Gemini 直接分析音频文件
      let result;
      try {
        console.log('   📡 上传音频文件到 Gemini API...');
        result = await geminiClient.generateJSONWithAudio(prompt, audioPath);
        console.log('   ✅ 音乐分析与分镜生成完成');
      } catch (error) {
        console.warn('   ⚠️  音频文件分析失败，使用文本模式分析');
        // 如果音频分析失败，回退到基于歌词和文件名的文本分析
        const fileName = path.basename(audioPath, path.extname(audioPath));
        const fallbackPrompt = `You are a professional music video producer. Please analyze the following music and generate a storyboard:

${lyricsText ? `Lyrics:\n${lyricsText}\n\n` : ''}Filename: ${fileName}

${prompt}`;
        result = await geminiClient.generateJSON(fallbackPrompt);
      }
      
      // 解析结果
      let parsedResult;
      if (result.raw) {
        try {
          parsedResult = typeof result.raw === 'string' ? JSON.parse(result.raw) : result.raw;
        } catch (e) {
          // 如果解析失败，尝试提取 JSON
          const jsonMatch = result.raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResult = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('无法解析 JSON 结果');
          }
        }
      } else {
        parsedResult = result;
      }

      // 验证和修正分镜脚本的时间 - 强制每个镜头8秒
      if (parsedResult.storyboard && parsedResult.storyboard.shots) {
        const shots = parsedResult.storyboard.shots;
        const SHOT_DURATION = 8.0; // 固定每个镜头8秒
        
        // 计算需要的镜头数量
        const requiredShots = Math.ceil(videoDuration / SHOT_DURATION);
        
        // 如果AI生成的镜头数量不对，重新生成镜头列表
        if (shots.length !== requiredShots) {
          console.log(`   ⚠️  AI生成了 ${shots.length} 个镜头，需要 ${requiredShots} 个镜头，正在修正...`);
          
          // 重新构建镜头列表，每个镜头固定8秒
          const newShots = [];
          for (let i = 0; i < requiredShots; i++) {
            const startTime = i * SHOT_DURATION;
            const endTime = i === requiredShots - 1 
              ? videoDuration  // 最后一个镜头结束在视频总时长
              : startTime + SHOT_DURATION;
            
            // 如果原镜头存在，保留其内容，只更新时间
            const originalShot = shots[i] || {};
            newShots.push({
              shotNumber: i + 1,
              timeRange: `${startTime.toFixed(2)}-${endTime.toFixed(2)}`,
              startTime: startTime,
              endTime: endTime,
              framing: originalShot.framing || '中景',
              composition: originalShot.composition || '默认构图',
              lighting: originalShot.lighting || '自然光',
              movement: originalShot.movement || '静止',
              action: originalShot.action || '画面动作',
              syncPoint: originalShot.syncPoint || `第${i + 1}个8秒段落`,
              beatPoint: originalShot.beatPoint || null,
              transition: originalShot.transition || { type: '切入', duration: 0.5 },
              prompt: originalShot.prompt || `第${i + 1}个镜头的视觉内容`,
            });
          }
          parsedResult.storyboard.shots = newShots;
        } else {
          // 如果数量正确，强制修正每个镜头的时间为8秒
          shots.forEach((shot, index) => {
            const startTime = index * SHOT_DURATION;
            const endTime = index === shots.length - 1 
              ? videoDuration  // 最后一个镜头结束在视频总时长
              : startTime + SHOT_DURATION;
            
            shot.startTime = startTime;
            shot.endTime = endTime;
            shot.timeRange = `${startTime.toFixed(2)}-${endTime.toFixed(2)}`;
            shot.shotNumber = index + 1;
          });
        }
        
        parsedResult.storyboard.totalDuration = videoDuration;
        console.log(`   ✅ 已修正为 ${parsedResult.storyboard.shots.length} 个镜头，每个镜头固定8秒`);
      }

      // 尝试获取音频基本信息（可选）
      let audioInfoDetail = null;
      let bpmInfo = null;
      try {
        audioInfoDetail = await audioUtils.getAudioInfo(audioPath);
        bpmInfo = await audioUtils.detectBPM(audioPath);
      } catch (error) {
        // 忽略音频信息获取错误
      }

      const finalResult = {
        audioInfo: audioInfoDetail || { duration: videoDuration, note: '未获取音频技术信息' },
        bpmInfo: bpmInfo || { note: '未检测BPM' },
        musicAnalysis: parsedResult.musicAnalysis,
        visualConcept: parsedResult.visualConcept,
        storyboard: parsedResult.storyboard,
        timestamp: new Date().toISOString(),
        analysisMethod: 'gemini-direct',
      };

      console.log(`   ✅ 生成完成：${parsedResult.storyboard?.shots?.length || 0} 个镜头`);
      return finalResult;
    } catch (error) {
      console.error('❌ 音乐分析与分镜生成失败:', error);
      throw error;
    }
  }
}

export default new MusicStoryboardGeneratorAgent();

