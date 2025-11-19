import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import config from '../config/config.js';

const FIRST_LAST_TO_VIDEO_MODEL = 'wanx2.1-kf2v-plus';

/**
 * 阿里云万相 AI 客户端
 * 用于调用阿里万象视频生成 API
 */
class AliyunClient {
  constructor() {
    if (!config.aliyun?.apiKey) {
      throw new Error('DASHSCOPE_API_KEY 未配置，请在 .env 文件中设置');
    }
    this.apiKey = config.aliyun.apiKey;
    this.baseUrl = config.aliyun.baseUrl;
  }

  /**
   * 下载并转换图片为 base64
   * @param {string} imagePath - 图片路径（本地文件路径）
   * @returns {Promise<string>} base64 data URL
   */
  async downloadAndConvertImage(imagePath) {
    console.log('📥 转换图片为 base64:', imagePath);
    
    // 检查是否为本地文件路径
    if (fs.existsSync(imagePath)) {
      const fileData = fs.readFileSync(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp'
      };
      
      const mimeType = mimeTypes[ext] || 'image/png';
      const base64 = fileData.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('✅ 图片转换为 base64，大小:', base64.length, 'bytes');
      return dataUrl;
    }
    
    // 如果是 URL，尝试下载
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const videoBuffer = Buffer.from(buffer);
      const base64 = videoBuffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('✅ 图片下载并转换为 base64，大小:', base64.length, 'bytes');
      return dataUrl;
    }
    
    // 如果已经是 base64 data URL
    if (imagePath.startsWith('data:')) {
      console.log('✅ 图片已经是 base64 格式');
      return imagePath;
    }
    
    throw new Error(`无法处理图片路径: ${imagePath}`);
  }

  /**
   * 首尾帧生视频 (First-Last-to-Video)
   * 支持 wanx2.1-kf2v-plus 模型
   * @param {string} firstFramePath - 首帧图片路径
   * @param {string} lastFramePath - 尾帧图片路径
   * @param {string} prompt - 提示词
   * @param {object} options - 选项
   * @returns {Promise<string>} task_id
   */
  async generateFirstLastToVideo(firstFramePath, lastFramePath, prompt, options = {}) {
    console.log('🎬 阿里万象首尾帧生视频请求');
    console.log('   首帧:', firstFramePath);
    console.log('   尾帧:', lastFramePath);
    console.log('   提示词:', prompt);
    
    const endpoint = `${this.baseUrl}/api/v1/services/aigc/image2video/video-synthesis`;
    
    // 将图片转换为 base64
    const firstFrameBase64 = await this.downloadAndConvertImage(firstFramePath);
    const lastFrameBase64 = await this.downloadAndConvertImage(lastFramePath);
    
    // 构建请求体
    const requestBody = {
      model: FIRST_LAST_TO_VIDEO_MODEL,
      input: {
        prompt: prompt,
        first_frame_url: firstFrameBase64,
        last_frame_url: lastFrameBase64,
      },
      parameters: {
        resolution: options.resolution || '720P',
        prompt_extend: options.prompt_extend !== undefined ? options.prompt_extend : true,
      }
    };
    
    // 处理负向提示词
    if (options.negative_prompt) {
      requestBody.input.negative_prompt = options.negative_prompt;
    }
    
    console.log('📤 发送首尾帧生视频请求到阿里万象 API...');
    console.log('🔗 Endpoint:', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-DashScope-Async': 'enable',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    console.log('📡 响应状态:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`阿里万象 API 错误: ${response.status} ${response.statusText} - ${error}`);
    }
    
    const data = await response.json();
    console.log('📦 阿里万象响应已接收');
    
    // 检查响应格式
    if (!data.output || !data.output.task_id) {
      throw new Error('阿里万象 API 响应格式无效');
    }
    
    const taskId = data.output.task_id;
    console.log('🆔 任务 ID:', taskId);
    
    return taskId;
  }

  /**
   * 轮询任务状态（单次）
   * @param {string} taskId - 任务 ID
   * @returns {Promise<object>} 任务状态结果
   */
  async pollTaskStatusOnce(taskId) {
    console.log('🔄 检查任务状态:', taskId);
    
    const statusResponse = await fetch(
      `${this.baseUrl}/api/v1/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );
    
    if (!statusResponse.ok) {
      throw new Error(`查询任务状态失败: ${statusResponse.status} ${statusResponse.statusText}`);
    }
    
    const statusData = await statusResponse.json();
    const taskStatus = statusData.output?.task_status || statusData.task_status;
    console.log('📊 任务状态:', taskStatus);
    
    if (taskStatus === 'SUCCEEDED') {
      // 提取视频 URL
      const videoUrl = statusData.output?.results?.video_url || 
                       statusData.output?.video_url || 
                       statusData.video_url;
      
      if (!videoUrl) {
        console.error('❌ 任务成功但未找到视频 URL');
        console.log('🔍 完整输出对象:', JSON.stringify(statusData.output, null, 2));
        return { 
          completed: false, 
          error: '任务成功但未找到视频 URL' 
        };
      }
      
      console.log('✅ 视频生成成功，URL:', videoUrl);
      return {
        completed: true,
        videoUrl: videoUrl
      };
    } else if (taskStatus === 'FAILED' || taskStatus === 'CANCELED') {
      console.error('❌ 视频生成失败:', statusData.output?.error_message || statusData.output?.message);
      return { 
        completed: true, 
        error: statusData.output?.error_message || statusData.output?.message || '任务失败' 
      };
    }
    
    return { completed: false };
  }

  /**
   * 下载视频文件
   * @param {string} videoUrl - 视频 URL
   * @param {string} outputPath - 输出路径
   * @returns {Promise<string>} 输出路径
   */
  async downloadVideo(videoUrl, outputPath) {
    console.log('📥 下载视频:', videoUrl);
    
    const response = await fetch(videoUrl);
    
    if (!response.ok) {
      throw new Error(`下载视频失败: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const videoBuffer = Buffer.from(buffer);
    
    // 确保输出目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, videoBuffer);
    console.log('✅ 视频下载完成:', outputPath);
    console.log('📊 视频大小:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');
    
    return outputPath;
  }

  /**
   * 生成视频（完整流程：提交任务 -> 轮询 -> 下载）
   * @param {string} firstFramePath - 首帧图片路径
   * @param {string} lastFramePath - 尾帧图片路径
   * @param {string} prompt - 提示词
   * @param {string} outputPath - 输出路径
   * @param {object} options - 选项
   * @returns {Promise<string>} 输出路径
   */
  async generateVideo(firstFramePath, lastFramePath, prompt, outputPath, options = {}) {
    const { 
      maxPolls = 120, 
      pollInterval = 10000,
      resolution = '720P',
      prompt_extend = true,
      negative_prompt
    } = options;
    
    // 提交任务
    const taskId = await this.generateFirstLastToVideo(
      firstFramePath, 
      lastFramePath, 
      prompt,
      { resolution, prompt_extend, negative_prompt }
    );
    
    console.log('⏳ 等待视频生成完成...');
    
    // 轮询任务状态
    let pollCount = 0;
    while (pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const status = await this.pollTaskStatusOnce(taskId);
      
      if (status.completed) {
        if (status.error) {
          throw new Error(`视频生成失败: ${status.error}`);
        }
        
        // 下载视频
        await this.downloadVideo(status.videoUrl, outputPath);
        return outputPath;
      }
      
      pollCount++;
      if (pollCount % 6 === 0) {
        console.log(`   ⏳ 已等待 ${Math.floor(pollCount * pollInterval / 1000 / 60)} 分钟...`);
      }
    }
    
    throw new Error('视频生成超时');
  }
}

export default new AliyunClient();

