import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import config from '../config/config.js';

class VideoComposerAgent {
  /**
   * 合并视频合成、调色、音频混音和最终渲染
   * 按照顺序合成视频，并加入音频
   */
  async compose(materials, audioPath, outputPath, visualConcept = null) {
    console.log('🎬 Agent 2: 视频合成器 - 开始合成...');
    
    try {
      // 过滤并排序素材
      const mediaInputs = materials
        .filter(m => m.path && fs.existsSync(m.path))
        .sort((a, b) => a.shotNumber - b.shotNumber);
      
      if (mediaInputs.length === 0) {
        throw new Error('没有可用的素材');
      }

      console.log(`   📹 处理 ${mediaInputs.length} 个素材...`);

      // 创建 FFmpeg 命令
      const command = ffmpeg();
      
      // 添加视频/图像输入
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

      // 构建复杂滤镜：缩放、填充、连接视频流，并应用调色
      const filters = [];
      
      // 为每个素材创建缩放和填充的流
      for (let i = 0; i < mediaInputs.length; i++) {
        const material = mediaInputs[i];
        
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
      filters.push(`${concatInputs}concat=n=${mediaInputs.length}:v=1:a=0[vconcat]`);
      
      // 应用视觉特效和调色（如果有）
      let videoOutputLabel = '[vconcat]';
      if (visualConcept && visualConcept.visualConcept) {
        const style = visualConcept.visualConcept.style?.name || '';
        const colorFilters = this.buildColorFilters(style);
        if (colorFilters) {
          filters.push(`[vconcat]${colorFilters}[vfinal]`);
          videoOutputLabel = '[vfinal]';
        }
      }

      const filterComplex = filters.join(';');

      // 设置输出选项
      command
        .complexFilter(filterComplex)
        .outputOptions([
          `-map`, videoOutputLabel,
          `-map`, `${mediaInputs.length}:a:0`,
          `-c:v`, `libx264`,
          `-preset`, `slow`, // 高质量编码
          `-crf`, `18`, // 高质量
          `-c:a`, `aac`,
          `-b:a`, `192k`,
          `-shortest`, // 以最短流为准
          `-movflags`, `+faststart`, // 优化网络播放
          `-pix_fmt`, `yuv420p`,
        ])
        .output(outputPath)
        .on('start', (cmdline) => {
          console.log('   🎬 开始合成视频...');
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r   📊 进度: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('\n   ✅ 视频合成完成');
          
          // 检查文件大小
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   📦 文件大小: ${fileSizeMB} MB`);
          }
        })
        .on('error', (err) => {
          console.error('\n   ❌ 视频合成失败:', err);
          throw err;
        });
      
      await new Promise((resolve, reject) => {
        command.run();
        command.on('end', resolve);
        command.on('error', reject);
      });
      
      return {
        materials,
        audioPath,
        outputPath,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ 视频合成失败:', error);
      throw error;
    }
  }

  /**
   * 根据风格构建调色滤镜
   */
  buildColorFilters(style) {
    if (!style) return null;
    
    const filters = [];
    const styleLower = style.toLowerCase();
    
    // 基础调色
    filters.push('eq=contrast=1.1:brightness=0.05:saturation=1.1');
    
    // 根据风格添加特定效果
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
    
    return filters.length > 0 ? filters.join(',') : null;
  }
}

export default new VideoComposerAgent();

