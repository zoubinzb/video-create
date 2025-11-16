import geminiClient from './gemini-client.js';

/**
 * 图像生成器
 * 简单封装 Gemini 图像生成 API
 */
class ImageGenerator {
  /**
   * 生成图像
   * @param {string} prompt - 图像生成提示词
   * @param {string} outputPath - 输出路径
   * @param {object} options - 选项
   * @param {number} options.width - 图像宽度，默认 1920
   * @param {number} options.height - 图像高度，默认 1080
   * @param {string} options.model - 模型名称，默认 'gemini-2.5-flash-image-preview'
   * @param {string|string[]} options.referenceImage - 参考图片路径（可选）
   */
  async generateImage(prompt, outputPath, options = {}) {
    const {
      width = 1920,
      height = 1080,
      model = 'gemini-2.5-flash-image-preview',
      referenceImage = null
    } = options;

    const geminiOptions = {
      model,
      temperature: 0.9,
      maxOutputTokens: 8192
    };

    if (referenceImage) {
      geminiOptions.referenceImage = referenceImage;
    }

    return await geminiClient.generateImage(prompt, outputPath, geminiOptions);
  }
}

export default new ImageGenerator();
