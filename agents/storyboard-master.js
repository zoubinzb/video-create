import geminiClient from '../utils/gemini-client.js';
import config from '../config/config.js';

class StoryboardMasterAgent {
  /**
   * 生成详细的分镜脚本
   */
  async generate(visualConcept) {
    console.log('📝 Agent 3: 脚本与分镜大师 - 开始生成...');
    
    try {
      const concept = visualConcept.visualConcept;
      const musicAnalysis = visualConcept.musicAnalysis;
      
      // 构建详细的场景描述
      const scenesDescription = concept.scenes?.map((scene, idx) => {
        return `场景 ${idx + 1} (${scene.timeRange}秒):
- 描述: ${scene.description}
- 关键词: ${scene.keywords?.join(', ') || '无'}
- 情感: ${scene.emotion || '未知'}
- 视觉元素: ${scene.visualElements?.join('; ') || '无'}`;
      }).join('\n\n') || '无场景信息';

      // 构建主题信息
      const themeInfo = musicAnalysis.analysis?.theme ? `
主题: ${musicAnalysis.analysis.theme.mainTheme}
关键词: ${musicAnalysis.analysis.theme.keywords?.join(', ') || '无'}` : '';

      const prompt = `你是一位专业的视频分镜师。基于以下视觉概念和音乐分析，为30秒音乐视频创建详细的分镜脚本。

**重要：你必须严格按照提供的视觉概念和场景描述来生成分镜脚本，不能偏离或创造新的主题！**

视觉概念：
- 风格名称: ${concept.style?.name || '未知'}
- 风格描述: ${concept.style?.description || '无'}
- 主色调: ${concept.colorPalette?.primary?.join(', ') || '未知'}
- 辅助色调: ${concept.colorPalette?.secondary?.join(', ') || '无'}
${themeInfo}

**场景规划（必须严格遵循）：**
${scenesDescription}

故事线: ${concept.storyline?.arc || '无'}
情绪曲线: ${concept.storyline?.emotionCurve || '无'}

视觉元素: ${concept.visualElements?.join('; ') || '无'}

音乐分析：
- BPM: ${musicAnalysis.analysis?.rhythm?.bpm || '未知'}
- 节奏特征: ${musicAnalysis.analysis?.rhythm?.character || '无'}
- 节奏变化点: ${musicAnalysis.analysis.rhythm?.changes?.join('秒, ') || '无'}秒
- 高潮时间: ${musicAnalysis.analysis.climax?.time || '未知'}秒
- 情感: ${musicAnalysis.analysis?.emotion?.primary || '未知'}

**分镜脚本要求：**
1. 必须严格按照上述场景规划来创建分镜，每个场景对应的时间段必须匹配
2. 将30秒视频细分为多个镜头（建议5-10个镜头），确保覆盖所有场景
3. 每个镜头必须包含：
   - 时间码（精确到秒，必须与场景时间段对齐）
   - 景别（全景/中景/近景/特写）
   - 构图描述（必须符合场景描述）
   - 光线描述（必须符合视觉概念的风格）
   - 动作/运动描述（必须符合场景的动作描述）
   - 与音乐的同步点
4. 转场建议：每个镜头之间的转场方式
5. 节奏对齐：确保镜头切换与音乐节拍对齐
6. **关键：画面动作描述必须与场景描述一致，不能偏离主题！**

请以 JSON 格式返回：
{
  "shots": [
    {
      "shotNumber": 镜头编号,
      "timeRange": "0-3",
      "startTime": 0,
      "endTime": 3,
      "framing": "景别（全景/中景/近景/特写）",
      "composition": "构图描述",
      "lighting": "光线描述（冷色调/暖色调/高对比等）",
      "movement": "镜头运动（推/拉/摇/移/静止）",
      "action": "画面动作描述",
      "syncPoint": "与音乐的同步点描述",
      "transition": {
        "type": "转场类型（淡入/淡出/切入/划像等）",
        "duration": 转场时长（秒）
      },
      "prompt": "用于图像/视频生成的详细提示词"
    }
  ],
  "totalDuration": 30,
  "notes": "分镜说明和注意事项"
}`;

      const storyboard = await geminiClient.generateJSON(prompt);
      
      const result = {
        visualConcept,
        storyboard: storyboard.raw ? JSON.parse(storyboard.raw) : storyboard,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ 分镜脚本生成完成');
      return result;
    } catch (error) {
      console.error('❌ 分镜脚本生成失败:', error);
      throw error;
    }
  }
}

export default new StoryboardMasterAgent();

