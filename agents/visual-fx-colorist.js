import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import config from '../config/config.js';

class VisualFXColoristAgent {
  /**
   * 应用视觉特效和调色
   */
  async process(inputPath, visualConcept, outputPath) {
    console.log('🎨 Agent 6: 视觉特效与调色师 - 开始处理...');
    
    try {
      const concept = visualConcept.visualConcept;
      const style = concept.style?.name || '';
      const colors = concept.colorPalette || {};
      
      // 根据风格应用不同的滤镜
      const filters = this.buildFilters(style, colors);
      
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters(filters)
          .outputOptions([
            `-c:v`, `libx264`,
            `-preset`, `medium`,
            `-crf`, `23`,
            `-c:a`, `copy`,
          ])
          .output(outputPath)
          .on('start', (cmdline) => {
            console.log('  应用视觉特效...');
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              process.stdout.write(`\r  进度: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log('\n✅ 视觉处理完成');
            resolve();
          })
          .on('error', (err) => {
            console.error('\n❌ 视觉处理失败:', err);
            reject(err);
          })
          .run();
      });
      
      return {
        inputPath,
        outputPath,
        style,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ 视觉处理失败:', error);
      // 如果处理失败，返回原文件
      return {
        inputPath,
        outputPath: inputPath,
        style: 'original',
        error: error.message,
      };
    }
  }

  /**
   * 根据风格构建滤镜
   */
  buildFilters(style, colors) {
    const filters = [];
    
    // 基础调色
    filters.push('eq=contrast=1.1:brightness=0.05:saturation=1.1');
    
    // 根据风格添加特定效果
    const styleLower = style.toLowerCase();
    
    if (styleLower.includes('赛博朋克') || styleLower.includes('cyberpunk')) {
      filters.push('curves=preset=strong_contrast');
      filters.push('hue=s=1.2');
    } else if (styleLower.includes('复古') || styleLower.includes('vintage')) {
      filters.push('curves=preset=vintage');
      filters.push('eq=saturation=0.8');
    } else if (styleLower.includes('电影') || styleLower.includes('cinematic')) {
      filters.push('curves=preset=medium_contrast');
      filters.push('eq=gamma=1.1');
    }
    
    return filters.join(',');
  }
}

export default new VisualFXColoristAgent();

