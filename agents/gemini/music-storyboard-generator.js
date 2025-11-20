import geminiClient from '../../utils/gemini-client.js';
import audioUtils from '../../utils/audio-utils.js';
import path from 'path';
import characterLibrary from '../../utils/character-library.js';

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
  // 构建角色库描述
  _buildCharacterLibraryDescription() {
    const characters = characterLibrary.getAllCharacters();
    const characterList = characters.map((char, index) => 
      `${index + 1}. ${char.name}: ${char.desc}`
    ).join('\n');
    return `**Available Characters (Character Library):**
You MUST use ONLY these predefined characters from the character library. Each shot should specify which character appears using the "characterName" field.

Available characters:
${characterList}

CRITICAL CHARACTER CONSISTENCY RULES:
1. **Character Framework**: This is a multi-scene narrative video. You should use:
   - 1-2 main characters (protagonists who drive the story)
   - 2-3 secondary characters (supporting roles, scene-specific characters, or characters that appear in specific narrative moments)
   - Total: 3-5 characters maximum

2. **Story-Driven Character Assignment** (CRITICAL):
   - **DO NOT** mechanically distribute characters by percentage or shot count
   - **DO** assign characters based on narrative logic, story progression, and scene requirements
   - Analyze the music content, lyrics, emotional arc, and story structure to determine which character fits each scene
   - Each character should appear when their presence serves the story, scene context, or narrative purpose

3. **Character Selection Based on Narrative**:
   - **Main characters (1-2)**: Choose based on who best represents the story's protagonist(s), central theme, or emotional journey. They will naturally appear more frequently as they drive the narrative forward.
   - **Secondary characters (2-3)**: Introduce when:
     * A specific scene requires a particular character (e.g., a scene about colors might feature a colorful character)
     * The narrative calls for interaction, contrast, or supporting roles
     * The music structure or lyrics suggest a character change
     * A scene's theme, mood, or visual concept matches a character's traits

4. **Scene-Based Character Logic**:
   - Each shot represents a scene in the narrative
   - Assign characters based on:
     * What the scene is about (theme, subject matter)
     * What the lyrics describe at that moment
     * The emotional tone and mood of that scene
     * The visual concept and composition needs
     * The narrative progression and story flow
   - Characters should appear naturally where they belong in the story, not forced into scenes

5. **Character Continuity**:
   - Maintain character consistency within story arcs or scene sequences
   - When the narrative transitions (e.g., verse to chorus, scene change), character changes should feel natural and story-driven
   - Avoid random character switching - each change should serve the narrative

6. **Each shot MUST include**: A "characterName" field specifying which character appears in that scene. The character choice should be justified by the scene's narrative purpose, theme, or visual requirements.

EXAMPLE NARRATIVE APPROACH:
- If the story is about learning colors: "蓝蓝熊" might appear in blue-themed scenes, "桃桃熊" in pink-themed scenes, etc.
- If the story follows a journey: Main character appears throughout, secondary characters appear at specific locations or moments
- If the story has multiple perspectives: Different characters might appear in different verses, representing different viewpoints
- Character distribution emerges naturally from the story, not from mechanical percentage allocation.`;
  }

  // 获取角色名称列表（用于 JSON 格式说明）
  _getCharacterNamesList() {
    const characters = characterLibrary.getAllCharacters();
    return characters.map(char => char.name).join(', ');
  }

  // 构建AI提示词
  _buildPrompt(videoDuration, lyricsText) {
    const shotsNeeded = Math.ceil(videoDuration / SHOT_DURATION);
    const characterLibraryDesc = this._buildCharacterLibraryDescription();
    const characterNamesList = this._getCharacterNamesList();
    return `You are a professional music video producer. Please carefully listen to and analyze this music, then generate a complete storyboard directly.

${characterLibraryDesc}


${lyricsText ? `Lyrics:\n${lyricsText}\n\n` : ''}**Task Requirements:**
You will create a Cocomelon-style animated music video with the following characteristics:
- Cocomelon style: bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere, smooth motion from keyframe, high quality, consistent style and visual continuity

1. Analyze the music's emotion, rhythm, theme, structure, and climax
2. Identify beat points in the music (rhythm changes, beat accents, climax, etc.)
3. Generate visual style and color scheme based on music analysis, ensuring it aligns with Cocomelon animation style
4. Generate a complete storyboard directly for a Cocomelon-style animated video. The total video duration must be exactly ${videoDuration.toFixed(2)} seconds

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
Based on music analysis, generate visual concepts that MUST align with Cocomelon animation style:
- Visual Style: MUST be Cocomelon style - bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere
- Color Scheme: Primary colors should be bright and vibrant (typical Cocomelon palette: bright blues, yellows, greens, pinks, oranges), secondary colors, color mood should be cheerful and warm
- Visual Element Suggestions: Recommended visual elements suitable for Cocomelon style (e.g., simple shapes, friendly characters, educational elements, playful animations, etc.)

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
   - characterName: The name of the character from the character library that appears in this shot (MUST be one of the characters listed above)
   - Framing (wide shot/medium shot/close-up/extreme close-up)
   - Composition description
   - Lighting description (cool tone/warm tone/high contrast, etc.)
   - Camera movement (push/pull/pan/track/static)
   - Action description (should be designed to sync with beat points in this shot)
   - Sync point with music (must explicitly mention beat point positions and how the shot syncs with them)
   - beatPoint: The time (in seconds) of the most prominent beat point within this shot's time range (if any)
   - Transition type (fade in/fade out/cut/wipe, etc.)
   - keyframePrompt: Detailed prompt for KEYFRAME generation - describes the INITIAL STATE of the scene (static image, starting moment before action begins, what the scene looks like at the beginning). Should describe the scene composition, characters' positions, expressions, and the static setup. Must mention the character name and describe the character according to the character library description. Must be in Cocomelon animation style.
     **SCENE RESTRICTIONS**: 
     - DO NOT create abstract, stylized, or overly artistic scenes
     - DO NOT use abstract patterns, geometric shapes as main elements, or surreal visual effects
     - DO create concrete, recognizable, child-friendly scenes (e.g., classroom, playground, home, garden, park, etc.)
     - Scenes must be simple, clear, and educational - suitable for young children
     - Backgrounds should be simple and recognizable, not abstract or stylized
     - Avoid artistic interpretations, abstract concepts, or complex visual metaphors
   - videoPrompt: Detailed prompt for VIDEO generation - describes what is HAPPENING in the scene (dynamic actions, movements, what characters are doing, how the scene animates). Should describe the action, motion, and animation that will happen. Must mention beat synchronization and be in Cocomelon animation style. Must maintain consistency with the character from the character library.
     **SCENE RESTRICTIONS**: 
     - DO NOT create abstract, stylized, or overly artistic animations
     - DO NOT use abstract visual effects, particle effects, or surreal transformations
     - DO create simple, clear, educational animations that children can understand
     - Actions should be concrete and recognizable (e.g., walking, jumping, playing, learning, singing, etc.)
     - Avoid abstract movements, artistic interpretations, or complex visual metaphors
6. **Key Requirements**:
   - Each shot must be strictly fixed at ${SHOT_DURATION} seconds (except the last shot)
   - The last shot's end time must be exactly ${videoDuration.toFixed(2)} seconds
   - Visual style and colors must be consistent with Cocomelon animation style: bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere
   - All shots must maintain Cocomelon style consistency throughout the video
   - **Each shot MUST reference the beat points within its time range in the syncPoint and beatPoint fields**
   - **CRITICAL: Story-Driven Character Assignment**: This is a multi-scene narrative video. Assign characters based on narrative logic, scene requirements, and story progression - NOT by mechanical percentage distribution. Use 1-2 main characters (protagonists) and 2-3 secondary characters (supporting/situation-specific roles), maximum 3-5 total characters. Each character should appear when their presence serves the story, scene context, or narrative purpose. Maintain character continuity within story arcs. Character distribution should emerge naturally from the narrative, not from forced percentages.
   - **CRITICAL: Scene Style Restrictions**: 
     - DO NOT create abstract, stylized, or overly artistic scenes
     - DO NOT use abstract patterns, geometric shapes as main elements, surreal visual effects, or artistic interpretations
     - DO create concrete, recognizable, child-friendly scenes (e.g., classroom, playground, home, garden, park, kitchen, bedroom, outdoor spaces, etc.)
     - All scenes must be simple, clear, educational, and suitable for young children
     - Backgrounds must be simple and recognizable - avoid abstract or stylized backgrounds
     - Actions and animations must be concrete and understandable (walking, jumping, playing, learning, singing, dancing, etc.)
     - Avoid abstract movements, particle effects, surreal transformations, or complex visual metaphors
     - Keep scenes grounded in reality and educational content, maintaining Cocomelon's simple and clear visual style

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
      "name": "Cocomelon animation style",
      "description": "Cocomelon style: bright vibrant colors, simple cute character design, smooth 3D animation, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds, educational and entertaining, playful and cheerful atmosphere",
      "references": "Cocomelon animation style reference notes"
    },
    "colorPalette": {
      "primary": ["bright vibrant colors typical of Cocomelon - bright blues, yellows, greens, pinks, oranges"],
      "secondary": ["secondary colors that complement the Cocomelon palette"],
      "mood": "cheerful, warm, playful, and child-friendly color mood"
    },
    "visualElements": ["simple shapes", "friendly characters", "educational elements", "playful animations", "Cocomelon-style visual elements"]
  },
  "storyboard": {
    "shots": [
      {
        "shotNumber": shot number (number),
        "timeRange": "0.00-${SHOT_DURATION}.00" (each shot fixed at ${SHOT_DURATION} seconds, format: 0.00-${SHOT_DURATION}.00, ${SHOT_DURATION}.00-${SHOT_DURATION * 2}.00...),
        "startTime": 0.00 (number, precise to 2 decimal places, each shot spaced ${SHOT_DURATION} seconds apart),
        "endTime": ${SHOT_DURATION}.00 (number, precise to 2 decimal places, each shot fixed at ${SHOT_DURATION} seconds, except the last shot),
        "characterName": "character name from character library (MUST be one of: ${characterNamesList})",
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
        "keyframePrompt": "detailed prompt for KEYFRAME generation - describes the INITIAL STATE of the scene (static image, starting moment before action begins, what the scene looks like at the beginning). Should describe the scene composition, characters' positions, expressions, and the static setup. Must be in Cocomelon animation style with bright vibrant colors, simple cute character design, child-friendly visual style, rounded friendly characters, clear lines, simple backgrounds. IMPORTANT: Create concrete, recognizable scenes (classroom, playground, home, garden, park, kitchen, bedroom, outdoor spaces, etc.) - DO NOT create abstract, stylized, or overly artistic scenes. Avoid abstract patterns, geometric shapes as main elements, or surreal visual effects.",
        "videoPrompt": "detailed prompt for VIDEO generation - describes what is HAPPENING in the scene (dynamic actions, movements, what characters are doing, how the scene animates). Should describe the action, motion, and animation that will happen, including beat synchronization. Must be in Cocomelon animation style with smooth 3D animation, educational and entertaining, playful and cheerful atmosphere. IMPORTANT: Create simple, clear, educational animations (walking, jumping, playing, learning, singing, dancing, etc.) - DO NOT create abstract, stylized animations, particle effects, or surreal transformations. Actions must be concrete and understandable for young children."
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
      console.log(`   🔍 提示词: ${prompt}`);
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

