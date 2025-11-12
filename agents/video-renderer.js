import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import config from '../config/config.js';

class VideoRendererAgent {
  /**
   * 视频渲染和优化
   */
  async render(inputPath, outputPath, options = {}) {
    console.log('🎬 Agent 8: 视频渲染与优化器 - 开始渲染...');
    
    try {
      const {
        width = config.video.width,
        height = config.video.height,
        fps = config.video.fps,
        format = 'mp4',
      } = options;
      
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .size(`${width}x${height}`)
          .fps(fps)
          .outputOptions([
            `-c:v`, `libx264`,
            `-preset`, `slow`, // 高质量编码
            `-crf`, `18`, // 高质量
            `-c:a`, `aac`,
            `-b:a`, `192k`,
            `-movflags`, `+faststart`, // 优化网络播放
            `-pix_fmt`, `yuv420p`,
          ])
          .format(format)
          .output(outputPath)
          .on('start', (cmdline) => {
            console.log('  渲染视频...');
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              process.stdout.write(`\r  进度: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log('\n✅ 视频渲染完成');
            
            // 检查文件大小
            const stats = fs.statSync(outputPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`📦 输出文件: ${outputPath}`);
            console.log(`📊 文件大小: ${fileSizeMB} MB`);
            
            resolve();
          })
          .on('error', (err) => {
            console.error('\n❌ 视频渲染失败:', err);
            reject(err);
          })
          .run();
      });
      
      return {
        inputPath,
        outputPath,
        format,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ 视频渲染失败:', error);
      throw error;
    }
  }
}

export default new VideoRendererAgent();

