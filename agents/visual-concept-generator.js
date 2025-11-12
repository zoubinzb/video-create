import geminiClient from '../utils/gemini-client.js';

class VisualConceptGeneratorAgent {
  /**
   * 基于音乐分析生成视觉概念
   */
  async generate(musicAnalysis) {
    console.log('🎨 Agent 2: 视觉概念生成器 - 开始生成...');
    
    try {
      const analysis = musicAnalysis.analysis;
      
      const prompt = `你是一位专业的视觉概念设计师。基于以下音乐分析，为30秒音乐视频生成视觉概念：

音乐分析：
- 情感: ${analysis.emotion?.primary || '未知'} (强度: ${analysis.emotion?.intensity || 0}/10)
- 主题: ${analysis.theme?.mainTheme || '未知'}
- 关键词: ${analysis.theme?.keywords?.join(', ') || '无'}
- 节奏: ${analysis.rhythm?.character || '未知'}
- 建议风格: ${analysis.visualSuggestions?.style || '未知'}

请为30秒视频生成详细的视觉概念，包括：

1. 整体视觉风格：推荐具体的视觉风格（如：赛博朋克、复古、极简、抽象、自然风、电影感等）
2. 色彩方案：详细的色彩调色板和使用建议
3. 场景分段：将30秒分为3-5个场景，每个场景提供：
   - 时间范围（如：0-10秒）
   - 场景描述（1-2句话）
   - 视觉关键词（用于后续图像生成）
   - 情绪变化
4. 故事线/情绪曲线：描述整个视频的情绪变化轨迹
5. 视觉元素建议：推荐使用的视觉元素（如：粒子、光效、抽象图形等）

请以 JSON 格式返回：
{
  "style": {
    "name": "风格名称",
    "description": "风格详细描述",
    "references": "参考风格说明"
  },
  "colorPalette": {
    "primary": ["主色1", "主色2"],
    "secondary": ["辅色1", "辅色2"],
    "mood": "色彩情绪描述"
  },
  "scenes": [
    {
      "timeRange": "0-10",
      "startTime": 0,
      "endTime": 10,
      "description": "场景描述",
      "keywords": ["关键词1", "关键词2", "关键词3"],
      "emotion": "场景情绪",
      "visualElements": ["元素1", "元素2"]
    }
  ],
  "storyline": {
    "arc": "故事线描述",
    "emotionCurve": "情绪曲线描述"
  },
  "visualElements": ["推荐元素1", "推荐元素2"]
}`;

      const concept = await geminiClient.generateJSON(prompt);
      
      const result = {
        musicAnalysis,
        visualConcept: concept.raw ? JSON.parse(concept.raw) : concept,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ 视觉概念生成完成');
      return result;
    } catch (error) {
      console.error('❌ 视觉概念生成失败:', error);
      throw error;
    }
  }
}

export default new VisualConceptGeneratorAgent();

