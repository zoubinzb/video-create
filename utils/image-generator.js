import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from './gemini-client.js';

/**
 * 图像生成器
 * 支持多种图像生成 API
 */
class ImageGenerator {
  constructor() {
    // 可以配置多个图像生成服务
    this.providers = {
      // 可以添加 Stable Diffusion, DALL-E 等
    };
  }

  /**
   * 生成图像
   * 优先使用 Gemini 图像生成模型
   */
  async generateImage(prompt, outputPath, options = {}) {
    const {
      width = 1920,
      height = 1080,
      style = 'cinematic',
      model = 'gemini-2.5-flash-image-preview',
    } = options;

    // 优先使用 Gemini 图像生成
    try {
      // 增强提示词，添加分辨率和质量要求
      const enhancedPrompt = this.enhancePrompt(prompt, { width, height, style });
      
      return await geminiClient.generateImage(enhancedPrompt, outputPath, {
        model: model,
        temperature: 0.9,
        maxOutputTokens: 8192,
      });
    } catch (error) {
      console.warn(`⚠️  Gemini 图像生成失败: ${error.message}`);
      console.warn('💡 将使用占位符图像作为后备方案');
      
      // 如果 Gemini 失败，使用占位符
      return await this.generatePlaceholder(prompt, outputPath, options);
    }
  }

  /**
   * 增强提示词，添加分辨率和质量要求
   */
  enhancePrompt(originalPrompt, options) {
    let enhanced = originalPrompt;
    
    // 添加分辨率信息
    enhanced += `, ${options.width}x${options.height} resolution`;
    
    // 添加质量要求
    enhanced += `, high quality, detailed, professional`;
    
    // 添加风格要求
    if (options.style) {
      enhanced += `, ${options.style} style`;
    }
    
    return enhanced;
  }

  /**
   * 使用外部 API 生成图像
   */
  async generateWithAPI(prompt, outputPath, apiUrl, apiKey, options) {
    // 这里可以根据不同的 API 实现不同的调用方式
    // 示例：Stable Diffusion API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: options.height,
        width: options.width,
        steps: 30,
      }),
    });

    if (!response.ok) {
      throw new Error(`图像生成 API 错误: ${response.statusText}`);
    }

    const data = await response.json();
    
    // 根据 API 响应格式提取图像
    // 这里需要根据实际 API 响应格式调整
    if (data.artifacts && data.artifacts[0]) {
      const imageBase64 = data.artifacts[0].base64;
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      return outputPath;
    }

    throw new Error('图像生成 API 返回格式不正确');
  }

  /**
   * 生成占位符图像（临时方案）
   */
  async generatePlaceholder(prompt, outputPath, options) {
    try {
      const { createCanvas } = await import('canvas');
      const canvas = createCanvas(options.width || 1920, options.height || 1080);
      const ctx = canvas.getContext('2d');
      
      // 创建渐变背景（基于提示词中的颜色）
      const colors = this.extractColorsFromPrompt(prompt);
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      
      if (colors.length > 0) {
        colors.forEach((color, index) => {
          gradient.addColorStop(index / (colors.length - 1 || 1), color);
        });
      } else {
        // 默认渐变
        gradient.addColorStop(0, '#2d1b4e');
        gradient.addColorStop(0.5, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 添加视觉元素（基于提示词）
      this.addVisualElements(ctx, prompt, canvas.width, canvas.height);
      
      // 保存图像
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      return outputPath;
    } catch (error) {
      console.error('占位符生成失败:', error);
      throw error;
    }
  }

  /**
   * 从提示词中提取颜色
   */
  extractColorsFromPrompt(prompt) {
    const colorRegex = /#([0-9A-Fa-f]{6})/g;
    const colors = [];
    let match;
    
    while ((match = colorRegex.exec(prompt)) !== null) {
      colors.push(`#${match[1]}`);
    }
    
    return colors.length > 0 ? colors : [];
  }

  /**
   * 添加视觉元素（基于提示词）
   */
  addVisualElements(ctx, prompt, width, height) {
    // 根据提示词添加简单的视觉元素
    const lowerPrompt = prompt.toLowerCase();
    
    // 添加一些抽象的形状
    ctx.globalAlpha = 0.3;
    
    if (lowerPrompt.includes('sky') || lowerPrompt.includes('cloud')) {
      // 添加云朵形状
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.5;
        this.drawCloud(ctx, x, y, 100 + Math.random() * 50);
      }
    }
    
    if (lowerPrompt.includes('light') || lowerPrompt.includes('bright')) {
      // 添加光效
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    ctx.globalAlpha = 1.0;
  }

  /**
   * 绘制云朵形状
   */
  drawCloud(ctx, x, y, size) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.3, y, size * 0.6, 0, Math.PI * 2);
    ctx.arc(x + size * 0.6, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default new ImageGenerator();

