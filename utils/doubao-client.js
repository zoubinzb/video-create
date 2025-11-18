import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import config from '../config/config.js';

/**
 * 豆包 AI 客户端
 * 用于调用豆包 API（字节跳动）
 */
class DoubaoClient {
  constructor() {
    if (!config.doubao?.apiKey) {
      throw new Error('ARK_API_KEY 或 DOUBAO_API_KEY 未配置，请在 .env 文件中设置');
    }
    this.apiKey = config.doubao.apiKey;
    this.baseUrl = config.doubao.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    this.defaultModel = config.doubao.model || 'doubao-seed-1-6-251015';
  }

  /**
   * 生成文本内容
   */
  async generateText(prompt, modelName = null) {
    try {
      const model = modelName || this.defaultModel;
      
      // 检查 API key 格式
      if (!this.apiKey || this.apiKey.trim() === '') {
        throw new Error('API key 为空，请检查 ARK_API_KEY 或 DOUBAO_API_KEY 环境变量');
      }
      
      const requestBody = {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `豆包 API 错误: ${response.status} - ${errorText}`;
        
        // 如果是 401 错误，提供更详细的提示
        if (response.status === 401) {
          errorMessage += '\n\n可能的解决方案：';
          errorMessage += '\n1. 检查 ARK_API_KEY 环境变量是否正确设置';
          errorMessage += '\n2. 确认 API key 格式正确（不应包含多余的空格或换行）';
          errorMessage += '\n3. 确认 API key 是否有效（可在火山引擎控制台查看）';
          errorMessage += `\n4. 当前使用的 baseUrl: ${this.baseUrl}`;
          errorMessage += `\n5. 当前使用的 model: ${model}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
    } catch (error) {
      console.error('豆包 API 错误:', error);
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

      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const fileData = fs.readFileSync(filePath);
      const base64Data = fileData.toString('base64');

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                  }
                }
              ]
            }
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`豆包 API 多模态错误: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
    } catch (error) {
      console.error('豆包 API 多模态错误:', error);
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
      const enhancedPrompt = `${prompt}\n\n请以 JSON 格式返回结果，确保格式正确。注意：
1. 不要在 JSON 中使用注释
2. 所有字符串必须用双引号
3. 数组最后一个元素后不要有逗号
4. 对象最后一个属性后不要有逗号
5. 确保所有括号都正确闭合`;
      const text = await this.generateText(enhancedPrompt, modelName);
      
      // 清理文本
      let cleanedText = this.cleanJSON(text);
      
      // 尝试提取 JSON（使用非贪婪匹配，找到第一个完整的大括号对）
      let jsonText = null;
      
      // 方法1：尝试找到最外层的 {}
      const firstBrace = cleanedText.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = firstBrace; i < cleanedText.length; i++) {
          const char = cleanedText[i];
          
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
                jsonText = cleanedText.substring(firstBrace, i + 1);
                break;
              }
            }
          }
        }
      }
      
      if (jsonText) {
        try {
          return JSON.parse(jsonText);
        } catch (parseError) {
          console.warn('JSON 解析失败，尝试简单匹配:', parseError.message);
          // 如果失败，尝试简单的正则匹配
          const simpleMatch = text.match(/\{[\s\S]*\}/);
          if (simpleMatch) {
            try {
              return JSON.parse(this.cleanJSON(simpleMatch[0]));
            } catch (e) {
              console.error('简单匹配也失败:', e.message);
            }
          }
        }
      }
      
      // 如果无法提取 JSON，返回文本
      console.warn('⚠️  无法从响应中提取 JSON，返回原始文本');
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
        throw parseError;
      }
    } catch (error) {
      console.error('豆包 API JSON 生成错误:', error);
      throw error;
    }
  }

  /**
   * 清理 JSON 文本
   */
  cleanJSON(jsonText) {
    // 移除可能的 markdown 代码块标记
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    // 移除行尾注释（简单处理）
    jsonText = jsonText.replace(/\/\/.*$/gm, '');
    
    // 移除尾随逗号（在 } 或 ] 之前）
    jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
    
    return jsonText.trim();
  }
}

export default new DoubaoClient();

