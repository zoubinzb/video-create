import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import config from '../config/config.js';

class AudioMixerAgent {
  /**
   * 音频混音和同步
   */
  async mix(videoPath, audioPath, outputPath) {
    console.log('🔊 Agent 7: 音频混音与同步师 - 开始处理...');
    
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .input(audioPath)
          .outputOptions([
            `-c:v`, `copy`,
            `-c:a`, `aac`,
            `-b:a`, `192k`,
            `-shortest`, // 以最短流为准
            `-map`, `0:v:0`,
            `-map`, `1:a:0`,
          ])
          .output(outputPath)
          .on('start', (cmdline) => {
            console.log('  混音音频...');
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              process.stdout.write(`\r  进度: ${Math.round(progress.percent)}%`);
            }
          })
          .on('end', () => {
            console.log('\n✅ 音频混音完成');
            resolve();
          })
          .on('error', (err) => {
            console.error('\n❌ 音频混音失败:', err);
            reject(err);
          })
          .run();
      });
      
      return {
        videoPath,
        audioPath,
        outputPath,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ 音频混音失败:', error);
      throw error;
    }
  }
}

export default new AudioMixerAgent();

