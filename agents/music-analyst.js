import geminiClient from '../utils/gemini-client.js';
import audioUtils from '../utils/audio-utils.js';
import fs from 'fs';
import path from 'path';

class MusicAnalystAgent {
  /**
   * 分析音乐文件 - 直接使用 Gemini 分析音频
   */
  async analyze(audioPath, lyricsText = null) {
    console.log('🎵 Agent 1: 音乐分析师 - 开始分析...');
    console.log('   使用 Gemini 直接分析音频文件...\n');
    
    try {
      // 构建分析提示词
      let prompt = `你是一位专业的音乐分析师。请仔细聆听并分析这首音乐：

`;

      if (lyricsText) {
        prompt += `歌词内容：
${lyricsText}

`;
      }

      prompt += `请基于你听到的音频内容，提供以下详细分析：

1. **情感识别**：识别歌曲的主要情绪（快乐、悲伤、激动、平静、浪漫、孤独、激昂、忧郁等），并给出情感强度（0-10分），以及次要情绪

2. **节奏分析**：分析歌曲的节奏特点
   - BPM（每分钟节拍数）的估计值
   - 节奏特点（快节奏、慢节奏、中等节奏、变化节奏等）
   - 节奏变化点的时间位置（秒）

3. **主题提取**：提取核心关键词和主题
   - 主要主题（如：爱情、自然、旅行、科技、梦想、成长、离别等）
   - 关键词列表（至少5个）

4. **结构分析**：识别歌曲的段落结构及其时间位置
   - 主歌（Verse）
   - 副歌（Chorus）
   - 桥段（Bridge）
   - 间奏（Interlude）
   - 每个段落的时间范围（开始时间-结束时间，单位：秒）

5. **高潮识别**：识别歌曲的高潮部分
   - 高潮出现的时间（秒）
   - 高潮的强度（0-10分）

6. **视觉建议**：基于音乐的整体特点，给出初步的视觉风格建议
   - 视觉风格（如：赛博朋克、复古、极简、抽象、自然风、电影感等）
   - 色彩调色板（至少3种主要颜色）
   - 视觉情绪描述

请以 JSON 格式返回结果，确保格式正确，包含以下字段：
{
  "emotion": {
    "primary": "主要情绪",
    "intensity": 强度分数（数字）,
    "secondary": ["次要情绪1", "次要情绪2"]
  },
  "rhythm": {
    "bpm": BPM值（数字）,
    "character": "节奏特点描述",
    "changes": ["节奏变化点的时间（秒）"]
  },
  "theme": {
    "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
    "mainTheme": "主要主题"
  },
  "structure": [
    {
      "type": "段落类型（主歌/副歌/桥段/间奏）",
      "startTime": 开始时间（秒，数字）,
      "endTime": 结束时间（秒，数字）,
      "description": "段落描述"
    }
  ],
  "climax": {
    "time": 高潮时间（秒，数字）,
    "intensity": 强度（数字）
  },
  "visualSuggestions": {
    "style": "建议的视觉风格",
    "colorPalette": ["颜色1", "颜色2", "颜色3"],
    "mood": "视觉情绪"
  }
}`;

      // 尝试使用 Gemini 直接分析音频文件
      let analysis;
      try {
        console.log('   📡 上传音频文件到 Gemini API...');
        analysis = await geminiClient.generateJSONWithAudio(prompt, audioPath);
        console.log('   ✅ 音频分析完成');
      } catch (error) {
        console.warn('   ⚠️  音频文件分析失败，使用文本模式分析');
        // 如果音频分析失败，回退到基于歌词和文件名的文本分析
        const fileName = path.basename(audioPath, path.extname(audioPath));
        const fallbackPrompt = `你是一位专业的音乐分析师。请分析以下音乐：

${lyricsText ? `歌词内容：\n${lyricsText}\n\n` : ''}文件名：${fileName}

${prompt}`;
        analysis = await geminiClient.generateJSON(fallbackPrompt);
      }
      
      // 尝试获取音频基本信息（可选，不影响主流程）
      let audioInfo = null;
      let bpmInfo = null;
      try {
        audioInfo = await audioUtils.getAudioInfo(audioPath);
        bpmInfo = await audioUtils.detectBPM(audioPath);
      } catch (error) {
        // 忽略音频信息获取错误
      }
      
      // 解析分析结果
      let parsedAnalysis;
      if (analysis.raw) {
        try {
          parsedAnalysis = typeof analysis.raw === 'string' ? JSON.parse(analysis.raw) : analysis.raw;
        } catch (e) {
          // 如果解析失败，尝试提取 JSON
          const jsonMatch = analysis.raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedAnalysis = JSON.parse(jsonMatch[0]);
          } else {
            parsedAnalysis = analysis;
          }
        }
      } else {
        parsedAnalysis = analysis;
      }
      
      // 合并结果
      const result = {
        audioInfo: audioInfo || { note: '未获取音频技术信息' },
        bpmInfo: bpmInfo || { note: '未检测BPM' },
        analysis: parsedAnalysis,
        timestamp: new Date().toISOString(),
        analysisMethod: 'gemini-direct',
      };

      console.log('✅ 音乐分析完成');
      return result;
    } catch (error) {
      console.error('❌ 音乐分析失败:', error);
      throw error;
    }
  }
}

export default new MusicAnalystAgent();

