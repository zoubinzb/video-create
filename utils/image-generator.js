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
      width = 1920,   // 1080p 默认宽度
      height = 1080,  // 1080p 默认高度
      model = 'gemini-2.5-flash-image-preview',
      referenceImage = null,
      aspectRatio = '16:9'  // 1080p 默认宽高比
    } = options;

    // 1080p 固定配置：1920x1080, 16:9
    const finalAspectRatio = aspectRatio || '16:9';

    const geminiOptions = {
      model,
      aspectRatio: finalAspectRatio  // 1080p: 16:9
    };

    if (referenceImage) {
      geminiOptions.referenceImage = referenceImage;
    }

    return await geminiClient.generateImage(prompt, outputPath, geminiOptions);
  }
}

export default new ImageGenerator();
