import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config/config.js';

class GeminiClient {
  constructor() {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY 未配置，请在 .env 文件中设置');
    }
    this.ai = new GoogleGenAI({
      apiKey: config.gemini.apiKey,
    });
    this.defaultModel = 'gemini-2.5-flash';
  }

  /**
   * 生成文本内容
   */
  async generateText(prompt, modelName = null) {
    try {
      const model = modelName || this.defaultModel;
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error('Gemini API 错误:', error);
      throw error;
    }
  }

  /**
   * 使用多模态输入生成文本（支持音频文件）
   */
  async generateTextWithFile(prompt, filePath, mimeType = null, modelName = null) {
    try {
      const model = modelName || this.defaultModel;
      
      // 自动检测 MIME 类型
      if (!mimeType) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.m4a': 'audio/mp4',
          '.flac': 'audio/flac',
          '.aac': 'audio/aac',
          '.ogg': 'audio/ogg',
        };
        mimeType = mimeTypes[ext] || 'audio/mpeg';
      }

      // 读取文件并转换为 base64
      const fileData = fs.readFileSync(filePath);
      const base64Data = fileData.toString('base64');

      // 构建多模态内容 - 根据新 API 格式
      const contents = {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
      };

      const response = await this.ai.models.generateContent({
        model: model,
        contents: contents,
      });
      
      return response.text;
    } catch (error) {
      console.error('Gemini API 多模态错误:', error);
      // 如果多模态失败，回退到纯文本模式
      console.warn('⚠️  多模态分析失败，回退到文本分析模式');
      return this.generateText(prompt, modelName);
    }
  }

  /**
   * 生成 JSON 格式的响应
   */
  async generateJSON(prompt, modelName = null) {
    try {
      const enhancedPrompt = `${prompt}\n\n请以 JSON 格式返回结果，确保格式正确。`;
      const text = await this.generateText(enhancedPrompt, modelName);
      
      // 尝试提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // 如果无法提取 JSON，返回文本
      return { raw: text };
    } catch (error) {
      console.error('JSON 解析错误:', error);
      return { raw: '', error: error.message };
    }
  }

  /**
   * 使用音频文件生成 JSON 分析结果
   */
  async generateJSONWithAudio(prompt, audioPath, modelName = null) {
    try {
      const enhancedPrompt = `${prompt}\n\n请以 JSON 格式返回结果，确保格式正确。注意：
1. 不要在 JSON 中使用注释
2. 所有字符串必须用双引号
3. 数组最后一个元素后不要有逗号
4. 对象最后一个属性后不要有逗号
5. 确保所有括号都正确闭合`;
      const text = await this.generateTextWithFile(enhancedPrompt, audioPath, null, modelName);
      
      // 尝试提取 JSON（使用非贪婪匹配，找到第一个完整的大括号对）
      let jsonText = null;
      
      // 方法1：尝试找到最外层的 {}
      const firstBrace = text.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = firstBrace; i < text.length; i++) {
          const char = text[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonText = text.substring(firstBrace, i + 1);
                break;
              }
            }
          }
        }
      }
      
      if (!jsonText) {
        console.error('❌ 无法从响应中提取 JSON');
        console.error('响应内容:', text.substring(0, 500));
        throw new Error('无法提取有效的 JSON');
      }
      
      // 清理 JSON 文本
      jsonText = this.cleanJSON(jsonText);
      
      // 尝试解析
      try {
        return JSON.parse(jsonText);
      } catch (parseError) {
        console.error('❌ JSON 解析失败');
        console.error('错误:', parseError.message);
        console.error('JSON 内容（前 1000 字符）:', jsonText.substring(0, 1000));
        
        // 保存错误的 JSON 到文件以便调试
        const errorLogPath = path.join(process.cwd(), 'output', `json_error_${Date.now()}.txt`);
        fs.writeFileSync(errorLogPath, `错误: ${parseError.message}\n\n原始响应:\n${text}\n\n提取的JSON:\n${jsonText}`, 'utf-8');
        console.error(`💾 错误日志已保存: ${errorLogPath}`);
        
        throw parseError;
      }
    } catch (error) {
      console.error('JSON 解析错误:', error);
      throw error;
    }
  }
  
  /**
   * 清理 JSON 文本，移除常见错误
   */
  cleanJSON(jsonText) {
    // 移除注释（// 和 /* */）
    jsonText = jsonText.replace(/\/\/.*$/gm, '');
    jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 移除尾随逗号（数组和对象中）
    jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
    
    return jsonText;
  }

  /**
   * 生成图像
   * @param {string} prompt - 图像生成提示词
   * @param {string} outputPath - 输出路径
   * @param {object} options - 选项
   */
  async generateImage(prompt, outputPath, options = {}) {
    const modelName = options.model || 'gemini-2.5-flash-image-preview';
    const referenceImage = options.referenceImage;
    
    // 构建内容
    let contents = prompt;
    
    if (referenceImage) {
      const imagePaths = Array.isArray(referenceImage) ? referenceImage : [referenceImage];
      const imageParts = [];
      
      for (const imgPath of imagePaths) {
        if (fs.existsSync(imgPath)) {
          const imageData = fs.readFileSync(imgPath);
          const ext = path.extname(imgPath).toLowerCase();
          const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp'
          };
          
          imageParts.push({
            inlineData: {
              data: imageData.toString('base64'),
              mimeType: mimeTypes[ext] || 'image/jpeg'
            }
          });
        }
      }
      
      if (imageParts.length > 0) {
        contents = [...imageParts, { text: prompt }];
      }
    }
    
    const response = await this.ai.models.generateContent({
      model: modelName,
      contents
    });
    
    // 提取图像数据
    let imageData = null;
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }
    }
    
    if (!imageData && response.text) {
      const base64Match = response.text.match(/data:image\/[^;]+;base64,([^\s"']+)/);
      if (base64Match) imageData = base64Match[1];
    }
    
    if (!imageData) {
      throw new Error('未找到图像数据');
    }
    
    const imageBuffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, imageBuffer);
    return outputPath;
  }

  /**
   * 生成视频
   * @param {string} prompt - 视频生成提示词
   * @param {string} outputPath - 输出路径
   * @param {string} modelName - 模型名称
   * @param {Array} referenceImages - 参考图像数组（首帧和尾帧）
   * @param {object} retryOptions - 重试选项
   */
  async generateVideo(prompt, outputPath, modelName = 'veo-3.1-generate-preview', referenceImages = [], retryOptions = {}) {
    const { maxRetries = 3, retryDelay = 60000, exponentialBackoff = true } = retryOptions;
    
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    
    // 处理参考图像
    const processImage = (imgPath) => {
      if (!fs.existsSync(imgPath)) return null;
      const fileData = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).toLowerCase();
      return {
        imageBytes: fileData.toString('base64'),
        mimeType: mimeTypes[ext] || 'image/png'
      };
    };
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = exponentialBackoff ? retryDelay * Math.pow(2, attempt - 1) : retryDelay;
          console.log(`   ⏳ 等待 ${delay / 1000} 秒后重试（第 ${attempt}/${maxRetries} 次）...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const videoParams = { model: modelName, prompt };
        
        if (referenceImages?.length > 0) {
          const firstFrame = processImage(referenceImages[0]);
          if (firstFrame) videoParams.image = firstFrame;
          
          if (referenceImages.length > 1) {
            const lastFrame = processImage(referenceImages[1]);
            if (lastFrame) videoParams.config = { lastFrame };
          }
        }
        
        let operation = await this.ai.models.generateVideos(videoParams);
        console.log('   ⏳ 等待视频生成完成...');
        
        let pollCount = 0;
        const maxPolls = 120;
        
        while (!operation.done && pollCount < maxPolls) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          operation = await this.ai.operations.getVideosOperation({ operation });
          pollCount++;
          
          if (pollCount % 6 === 0) {
            console.log(`   ⏳ 已等待 ${Math.floor(pollCount * 10 / 60)} 分钟...`);
          }
        }

        if (!operation.done) {
          throw new Error('视频生成超时');
        }

        if (!operation.response?.generatedVideos?.[0]) {
          throw new Error('视频生成失败：未返回视频文件');
        }

        await this.ai.files.download({
          file: operation.response.generatedVideos[0].video,
          downloadPath: outputPath
        });

        return outputPath;
      } catch (error) {
        if (error.status === 429 || error.message?.includes('429')) {
          if (attempt === maxRetries) {
            throw new Error(`API 配额已用完：${error.message}`);
          }
          console.log(`   ⚠️  配额超限，将重试...`);
          continue;
        }
        
        if (attempt === maxRetries) throw error;
        console.warn(`   ⚠️  生成失败（尝试 ${attempt + 1}/${maxRetries + 1}）: ${error.message}`);
      }
    }
    
    throw new Error('视频生成失败');
  }
}

export default new GeminiClient();
