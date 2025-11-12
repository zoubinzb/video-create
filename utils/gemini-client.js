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
      const enhancedPrompt = `${prompt}\n\n请以 JSON 格式返回结果，确保格式正确。`;
      const text = await this.generateTextWithFile(enhancedPrompt, audioPath, null, modelName);
      
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
   * 生成图像（使用 gemini-2.5-flash-image-preview）
   */
  async generateImage(prompt, outputPath, options = {}) {
    try {
      const modelName = options.model || 'gemini-2.5-flash-image-preview';
      
      console.log(`   🎨 使用 ${modelName} 生成图像...`);
      
      // 调用 Gemini 图像生成 API
      // 根据 @google/genai 库的格式
      const response = await this.ai.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      
      // 解析响应，提取图像数据
      // 检查不同的响应格式
      let imageData = null;
      
      // 方式1: 检查 response.candidates
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        
        if (candidate.content) {
          // 检查 content.parts
          if (candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                imageData = part.inlineData.data;
                break;
              }
            }
          }
          
          // 检查 content.text（可能包含 base64）
          if (!imageData && candidate.content.text) {
            const base64Match = candidate.content.text.match(/data:image\/[^;]+;base64,([^\s"']+)/);
            if (base64Match) {
              imageData = base64Match[1];
            }
          }
        }
      }
      
      // 方式2: 检查 response.text
      if (!imageData && response.text) {
        const base64Match = response.text.match(/data:image\/[^;]+;base64,([^\s"']+)/);
        if (base64Match) {
          imageData = base64Match[1];
        }
      }
      
      // 方式3: 检查 response 本身是否包含图像数据
      if (!imageData && response.data) {
        if (typeof response.data === 'string') {
          imageData = response.data;
        } else if (response.data.inlineData && response.data.inlineData.data) {
          imageData = response.data.inlineData.data;
        }
      }
      
      if (imageData) {
        // 解码 base64 图像数据
        const imageBuffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`   ✅ 图像已保存到: ${outputPath}`);
        return outputPath;
      }
      
      // 如果所有方式都失败，打印响应以便调试
      console.error('API 响应结构:', JSON.stringify(response, null, 2).substring(0, 500));
      throw new Error('未找到图像数据，API 响应格式可能不正确。请检查 API 响应结构。');
    } catch (error) {
      console.error('图像生成错误:', error.message);
      // 如果 API 调用失败，抛出错误让调用者处理
      throw error;
    }
  }

  /**
   * 生成视频（使用 veo-3.1-generate-preview，支持参考图像和重试机制）
   */
  async generateVideo(prompt, outputPath, modelName = 'veo-3.1-generate-preview', referenceImages = [], retryOptions = {}) {
    const {
      maxRetries = 3,
      retryDelay = 60000, // 60秒延迟
      exponentialBackoff = true,
    } = retryOptions;
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = exponentialBackoff ? retryDelay * Math.pow(2, attempt - 1) : retryDelay;
          console.log(`   ⏳ 等待 ${delay / 1000} 秒后重试（第 ${attempt}/${maxRetries} 次）...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        
        console.log(`   🎬 开始生成视频: ${prompt.substring(0, 60)}...`);
        
        // 构建视频生成参数
        // 根据官方文档，使用 image（首帧）和 config.lastFrame（尾帧）
        const videoParams = {
          model: modelName,
          prompt: prompt,
        };
        
        // 处理首尾帧图像
        // 根据官方文档和错误信息，使用 bytesBase64Encoded 和 mimeType
        let firstFrameImage = null;
        let lastFrameImage = null;
        
        if (referenceImages && referenceImages.length > 0) {
          // 第一张图像作为首帧（image 参数）
          const firstImg = referenceImages[0];
          if (typeof firstImg === 'string' && fs.existsSync(firstImg)) {
            const fileData = fs.readFileSync(firstImg);
            const ext = path.extname(firstImg).toLowerCase();
            const mimeTypes = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.webp': 'image/webp',
            };
            const mimeType = mimeTypes[ext] || 'image/png';
            
            // 根据官方文档 JavaScript 示例，使用 imageBytes（官方格式）
            // 官方文档：image: { imageBytes: ..., mimeType: "image/png" }
            const base64String = fileData.toString('base64');
            firstFrameImage = {
              imageBytes: base64String,
              mimeType: mimeType,
            };
            console.log(`   📸 首帧图像: ${path.basename(firstImg)} (${mimeType})`);
          } else if (typeof firstImg === 'object') {
            // 如果已经是对象格式，检查并转换为正确的格式（驼峰格式）
            if (firstImg.bytesBase64Encoded || firstImg.bytes_base64_encoded) {
              // 如果已经是正确格式，直接使用
              firstFrameImage = {
                bytesBase64Encoded: firstImg.bytesBase64Encoded || firstImg.bytes_base64_encoded,
                mimeType: firstImg.mimeType || firstImg.mime_type || 'image/png',
              };
            } else if (firstImg.imageBytes) {
              // 转换 imageBytes 为 bytesBase64Encoded
              firstFrameImage = {
                bytesBase64Encoded: firstImg.imageBytes,
                mimeType: firstImg.mimeType || firstImg.mime_type || 'image/png',
              };
            } else if (firstImg.inlineData) {
              firstFrameImage = {
                bytesBase64Encoded: firstImg.inlineData.data,
                mimeType: firstImg.inlineData.mimeType || 'image/png',
              };
            }
          }
          
          // 第二张图像作为尾帧（config.lastFrame）
          if (referenceImages.length > 1) {
            const lastImg = referenceImages[1];
            if (typeof lastImg === 'string' && fs.existsSync(lastImg)) {
              const fileData = fs.readFileSync(lastImg);
              const ext = path.extname(lastImg).toLowerCase();
              const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
              };
              const mimeType = mimeTypes[ext] || 'image/png';
              
              // 根据官方文档，使用 imageBytes（官方格式）
              const base64String = fileData.toString('base64');
              lastFrameImage = {
                imageBytes: base64String,
                mimeType: mimeType,
              };
              console.log(`   📸 尾帧图像: ${path.basename(lastImg)} (${mimeType})`);
            } else if (typeof lastImg === 'object') {
              // 如果已经是对象格式，检查并转换为正确的格式（驼峰格式）
              if (lastImg.bytesBase64Encoded || lastImg.bytes_base64_encoded) {
                // 如果已经是正确格式，直接使用
                lastFrameImage = {
                  bytesBase64Encoded: lastImg.bytesBase64Encoded || lastImg.bytes_base64_encoded,
                  mimeType: lastImg.mimeType || lastImg.mime_type || 'image/png',
                };
              } else if (lastImg.imageBytes) {
                // 转换 imageBytes 为 bytesBase64Encoded
                lastFrameImage = {
                  bytesBase64Encoded: lastImg.imageBytes,
                  mimeType: lastImg.mimeType || lastImg.mime_type || 'image/png',
                };
              } else if (lastImg.inlineData) {
                lastFrameImage = {
                  bytesBase64Encoded: lastImg.inlineData.data,
                  mimeType: lastImg.inlineData.mimeType || 'image/png',
                };
              }
            }
          }
        }
        
        // 设置首帧（image 参数）
        if (firstFrameImage) {
          videoParams.image = firstFrameImage;
        }
        
        // 设置尾帧（config.lastFrame）
        if (lastFrameImage) {
          videoParams.config = {
            lastFrame: lastFrameImage,
          };
        }
        
        // 开始生成视频
        console.log(`   📤 调用 Veo API，${firstFrameImage ? '包含首帧' : ''}${firstFrameImage && lastFrameImage ? '和' : ''}${lastFrameImage ? '尾帧' : ''}`);
        
        // 调试：打印参数结构（仅打印关键信息，不打印完整的 base64）
        if (firstFrameImage) {
          const base64Data = firstFrameImage.bytesBase64Encoded || firstFrameImage.bytes_base64_encoded || '';
          const mimeType = firstFrameImage.mimeType || firstFrameImage.mime_type || '';
          console.log(`   🔍 首帧参数结构: { bytesBase64Encoded: '${base64Data.substring(0, 20)}...', mimeType: '${mimeType}' }`);
        }
        if (lastFrameImage) {
          const base64Data = lastFrameImage.bytesBase64Encoded || lastFrameImage.bytes_base64_encoded || '';
          const mimeType = lastFrameImage.mimeType || lastFrameImage.mime_type || '';
          console.log(`   🔍 尾帧参数结构: { bytesBase64Encoded: '${base64Data.substring(0, 20)}...', mimeType: '${mimeType}' }`);
        }
        
        let operation = await this.ai.models.generateVideos(videoParams);

        console.log('   ⏳ 等待视频生成完成...');
        
        // 轮询操作状态直到完成
        let pollCount = 0;
        const maxPolls = 120; // 最多轮询 20 分钟（120 * 10秒）
        
        while (!operation.done && pollCount < maxPolls) {
          await new Promise((resolve) => setTimeout(resolve, 10000)); // 等待 10 秒
          operation = await this.ai.operations.getVideosOperation({
            operation: operation,
          });
          pollCount++;
          
          if (pollCount % 6 === 0) { // 每分钟输出一次进度
            console.log(`   ⏳ 已等待 ${Math.floor(pollCount * 10 / 60)} 分钟...`);
          }
        }

        if (!operation.done) {
          throw new Error('视频生成超时，请稍后重试');
        }

        // 检查是否有生成的视频
        if (!operation.response || !operation.response.generatedVideos || operation.response.generatedVideos.length === 0) {
          throw new Error('视频生成失败：未返回视频文件');
        }

        // 下载生成的视频
        console.log('   📥 下载生成的视频...');
        await this.ai.files.download({
          file: operation.response.generatedVideos[0].video,
          downloadPath: outputPath,
        });

        console.log(`   ✅ 视频已保存到: ${outputPath}`);
        return outputPath;
      } catch (error) {
        lastError = error;
        
        // 检查是否是配额错误（429）
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
          console.error(`   ❌ API 配额超限 (429): ${error.message}`);
          if (attempt < maxRetries) {
            console.log(`   💡 将在重试时等待更长时间...`);
            continue; // 继续重试
          } else {
            throw new Error(`API 配额已用完。请检查您的配额和账单：${error.message}`);
          }
        }
        
        // 其他错误，如果是最后一次尝试则抛出
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 其他错误也继续重试
        console.warn(`   ⚠️  视频生成失败（尝试 ${attempt + 1}/${maxRetries + 1}）: ${error.message}`);
      }
    }
    
    // 如果所有重试都失败，抛出最后一个错误
    throw lastError || new Error('视频生成失败：未知错误');
  }
}

export default new GeminiClient();
