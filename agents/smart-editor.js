import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import config from '../config/config.js';

class SmartEditorAgent {
  /**
   * 智能剪辑视频
   */
  async edit(materials, audioPath, outputPath) {
    console.log('✂️ Agent 5: 智能剪辑师 - 开始剪辑...');
    
    try {
      // 创建视频合成命令
      const command = ffmpeg();
      
      // 添加视频/图像输入
      const mediaInputs = materials
        .filter(m => m.path && fs.existsSync(m.path))
        .sort((a, b) => a.shotNumber - b.shotNumber);
      
      if (mediaInputs.length === 0) {
        throw new Error('没有可用的素材');
      }
      
      // 为每个素材设置输入
      mediaInputs.forEach((material, index) => {
        const duration = material.endTime - material.startTime;
        
        if (material.type === 'video') {
          // 视频文件：裁剪到指定时长
          command.input(material.path)
            .inputOptions([`-t`, `${duration}`]);
        } else {
          // 图像文件：循环播放指定时长
          command.input(material.path)
            .inputOptions([`-loop`, `1`, `-t`, `${duration}`]);
        }
      });
      
      // 添加音频
      command.input(audioPath);
      
      // 使用复杂滤镜进行合成
      const filterComplex = this.buildFilterComplex(mediaInputs);
      
      command
        .complexFilter(filterComplex)
        .outputOptions([
          `-map`, `[v]`,
          `-map`, `${mediaInputs.length}:a`,
          `-c:v`, `libx264`,
          `-preset`, `medium`,
          `-crf`, `23`,
          `-c:a`, `aac`,
          `-b:a`, `192k`,
          `-shortest`,
          `-pix_fmt`, `yuv420p`,
        ])
        .output(outputPath)
        .on('start', (cmdline) => {
          console.log('  执行命令:', cmdline);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r  进度: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('\n✅ 剪辑完成');
        })
        .on('error', (err) => {
          console.error('\n❌ 剪辑失败:', err);
          throw err;
        });
      
      await new Promise((resolve, reject) => {
        command.run();
        command.on('end', resolve);
        command.on('error', reject);
      });
      
      return {
        materials,
        outputPath,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ 剪辑失败:', error);
      throw error;
    }
  }

  /**
   * 构建 FFmpeg 复杂滤镜
   */
  buildFilterComplex(mediaInputs) {
    const filters = [];
    
    // 为每个素材创建缩放和填充的流
    for (let i = 0; i < mediaInputs.length; i++) {
      const material = mediaInputs[i];
      const duration = material.endTime - material.startTime;
      
      if (material.type === 'video') {
        // 视频：缩放、填充、设置时长
        filters.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30[v${i}]`);
      } else {
        // 图像：缩放、填充、转换为视频流
        filters.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setpts=PTS-STARTPTS,fps=30[v${i}]`);
      }
    }
    
    // 连接所有视频流
    const concatInputs = mediaInputs.map((_, i) => `[v${i}]`).join('');
    filters.push(`${concatInputs}concat=n=${mediaInputs.length}:v=1:a=0[v]`);
    
    return filters;
  }
}

export default new SmartEditorAgent();

