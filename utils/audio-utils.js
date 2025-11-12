import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import config from '../config/config.js';

class AudioUtils {
  /**
   * 检查 FFmpeg 是否可用
   */
  isFFmpegAvailable() {
    try {
      execSync('ffprobe -version', { encoding: 'utf-8', stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取音频文件的基本信息
   */
  async getAudioInfo(audioPath) {
    // 检查 FFmpeg 是否可用
    if (!this.isFFmpegAvailable()) {
      console.warn('⚠️  FFmpeg 未安装，将使用默认音频信息');
      console.warn('💡 提示：安装 FFmpeg 可获得更准确的音频分析');
      console.warn('   Windows: 下载 https://ffmpeg.org/download.html 并添加到 PATH');
      console.warn('   macOS: brew install ffmpeg');
      console.warn('   Linux: sudo apt install ffmpeg\n');
      
      // 返回默认值
      return {
        duration: 30, // 默认30秒
        bitrate: 128000,
        sampleRate: 44100,
        channels: 2,
        codec: 'mp3',
        format: 'mp3',
        note: '使用默认值（FFmpeg 未安装）',
      };
    }

    try {
      // 使用 ffprobe 获取音频信息
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${audioPath}"`;
      const output = execSync(command, { encoding: 'utf-8' });
      const info = JSON.parse(output);
      
      const audioStream = info.streams.find(s => s.codec_type === 'audio');
      const format = info.format;
      
      return {
        duration: parseFloat(format.duration) || 30,
        bitrate: parseInt(format.bit_rate) || 128000,
        sampleRate: parseInt(audioStream?.sample_rate) || 44100,
        channels: parseInt(audioStream?.channels) || 2,
        codec: audioStream?.codec_name || 'unknown',
        format: format.format_name || 'unknown',
      };
    } catch (error) {
      console.warn('⚠️  获取音频信息失败，使用默认值:', error.message);
      // 返回默认值而不是抛出错误
      return {
        duration: 30,
        bitrate: 128000,
        sampleRate: 44100,
        channels: 2,
        codec: 'mp3',
        format: 'mp3',
        note: '使用默认值（获取音频信息失败）',
      };
    }
  }

  /**
   * 提取音频片段（用于分析）
   */
  async extractAudioSegment(inputPath, startTime, duration, outputPath) {
    if (!this.isFFmpegAvailable()) {
      throw new Error('FFmpeg 未安装，无法提取音频片段。请先安装 FFmpeg。');
    }
    
    try {
      const command = `ffmpeg -i "${inputPath}" -ss ${startTime} -t ${duration} -acodec copy "${outputPath}"`;
      execSync(command);
      return outputPath;
    } catch (error) {
      console.error('提取音频片段失败:', error);
      throw error;
    }
  }

  /**
   * 检测音频的 BPM（简化版本，实际需要更复杂的算法）
   */
  async detectBPM(audioPath) {
    // 这是一个简化的实现，实际应该使用专门的 BPM 检测库
    // 这里返回一个估计值
    try {
      const info = await this.getAudioInfo(audioPath);
      // 简单估算：假设大多数流行音乐在 60-180 BPM 之间
      // 这里返回一个默认值，实际应该使用音频分析库
      return {
        bpm: 120, // 默认值
        confidence: info.note ? 0.3 : 0.5,
        note: info.note || '这是估算值，实际应使用专业 BPM 检测算法',
      };
    } catch (error) {
      console.warn('BPM 检测失败，使用默认值:', error.message);
      return { 
        bpm: 120, 
        confidence: 0.3,
        note: '使用默认值（BPM 检测失败）',
      };
    }
  }

  /**
   * 将音频转换为 WAV 格式（用于分析）
   */
  async convertToWav(inputPath, outputPath) {
    if (!this.isFFmpegAvailable()) {
      throw new Error('FFmpeg 未安装，无法转换音频格式。请先安装 FFmpeg。');
    }
    
    try {
      const command = `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${outputPath}"`;
      execSync(command);
      return outputPath;
    } catch (error) {
      console.error('音频转换失败:', error);
      throw error;
    }
  }
}

export default new AudioUtils();

