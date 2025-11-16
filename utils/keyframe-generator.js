import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';

/**
 * 关键帧生成器
 * 简单封装关键帧生成逻辑
 */
class KeyframeGenerator {
  /**
   * 生成单个关键帧图像
   * @param {string} prompt - 图像生成提示词
   * @param {number} shotNumber - 镜头编号
   * @param {string} outputDir - 输出目录
   * @returns {Promise<object>} 关键帧信息
   */
  async generateKeyframe(prompt, shotNumber, outputDir) {
    const keyframePath = path.join(outputDir, `keyframe_${shotNumber}.png`);
    
    // 使用 geminiClient 生成图像
    await geminiClient.generateImage(prompt, keyframePath, {
      model: 'gemini-2.5-flash-image-preview',
      temperature: 0.9,
      maxOutputTokens: 8192
    });
    
    const url = `./keyframes/${path.basename(keyframePath)}`;
    
    return {
      path: keyframePath,
      url,
      absolutePath: keyframePath,
      shotNumber,
      prompt,
      type: 'keyframe',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 为多个镜头生成关键帧
   * @param {Array} shots - 镜头列表
   * @param {object} storyboard - 分镜脚本
   * @returns {Promise<Array>} 关键帧列表
   */
  async generateKeyframes(shots, storyboard) {
    const outputDir = path.join(config.paths.output, 'keyframes');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`\n🎨 开始生成关键帧图像...`);
    console.log(`   目标: ${shots.length} 个关键帧\n`);
    
    const keyframes = [];
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const prompt = shot.prompt || this.buildKeyframePrompt(shot, storyboard);
      
      console.log(`  🖼️  生成关键帧 ${shot.shotNumber}/${shots.length}...`);
      
      try {
        const keyframe = await this.generateKeyframe(prompt, shot.shotNumber, outputDir);
        keyframes.push(keyframe);
        console.log(`  ✅ 关键帧 ${shot.shotNumber} 生成完成`);
      } catch (error) {
        console.error(`  ❌ 关键帧 ${shot.shotNumber} 生成失败:`, error.message);
        throw error;
      }
    }
    
    console.log(`\n✅ 关键帧生成完成: ${keyframes.length} 个`);
    return keyframes;
  }

  /**
   * 构建关键帧提示词
   * @param {object} shot - 镜头信息
   * @param {object} storyboard - 分镜脚本
   * @returns {string} 提示词
   */
  buildKeyframePrompt(shot, storyboard) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    const parts = [shot.composition, shot.framing, shot.lighting];
    if (shot.action) parts.push(shot.action);
    if (style) parts.push(`${style} style`);
    if (colors) parts.push(`${colors} color palette`);
    parts.push('cinematic, high quality, detailed, still frame, keyframe');
    
    return parts.join(', ');
  }
}

export default new KeyframeGenerator();
