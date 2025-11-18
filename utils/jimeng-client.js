import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import crypto from 'crypto';

/**
 * 即梦 AI 客户端
 * 用于调用即梦图片生成 API
 * 基于火山引擎 V4 签名算法
 */
class JimengClient {
  constructor() {
    this.apiKey = config.jimeng.apiKey;
    this.apiSecret = config.jimeng.apiSecret;
    this.endpoint = config.jimeng.endpoint;
    this.reqKey = config.jimeng.reqKey;
    this.region = 'cn-north-1';
    this.service = 'cv';
  }

  /**
   * 获取当前时间（格式：20210818T095729Z）
   */
  _getTime() {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * HMAC-SHA256 签名（返回二进制数据）
   */
  _hmacDigest(key, data) {
    const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'utf-8') : key;
    return crypto.createHmac('sha256', keyBuffer).update(data, 'utf-8').digest();
  }

  /**
   * SHA256 哈希
   */
  _hash(str) {
    return crypto.createHash('sha256').update(str, 'utf-8').digest('hex');
  }

  /**
   * 格式化查询字符串（用于签名）
   * 注意：用于签名的查询字符串不需要 URL 编码，但用于实际请求的 URL 需要编码
   */
  _formatQuery(parameters) {
    const sortedKeys = Object.keys(parameters).sort();
    return sortedKeys.map(key => `${key}=${parameters[key]}`).join('&');
  }

  /**
   * 格式化查询字符串（用于 URL）
   * 对值进行 URL 编码
   */
  _formatQueryForUrl(parameters) {
    const sortedKeys = Object.keys(parameters).sort();
    return sortedKeys.map(key => {
      const value = parameters[key];
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }).join('&');
  }

  /**
   * 生成签名（按照火山引擎 V4 签名算法）
   * 参考 volcengine.ts 中的签名逻辑
   */
  _signRequest(method, uri, queryParams, headers, body, credentialScope) {
    // 从 headers 中获取值（必须使用实际发送的值）
    const date = headers['X-Date'] || this._getTime();
    const datestamp = date.substring(0, 8); // 格式：20210818
    
    // 确保使用小写的 header 键名（规范要求）
    const host = (headers['host'] || headers['Host'] || 'visual.volcengineapi.com').toLowerCase();
    const contentType = (headers['Content-Type'] || headers['content-type'] || 'application/json').toLowerCase();
    const xContentSha256 = headers['X-Content-SHA256'] || headers['x-content-sha256'] || this._hash(body || '');
    
    // 构建 canonical headers（必须按字母顺序排序）
    const canonicalHeadersMap = {
      'content-type': contentType.trim(),
      'host': host.trim(),
      'x-content-sha256': xContentSha256.trim(),
      'x-date': date.trim()
    };
    
    // 按字母顺序排序并构建 canonical headers
    const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
    const canonicalHeaders = sortedHeaderKeys
      .map(key => `${key}:${canonicalHeadersMap[key]}`)
      .join('\n') + '\n';
    
    // 构建 signed headers（按字母顺序）
    const signedHeaders = sortedHeaderKeys.join(';');
    
    // 格式化查询字符串（用于签名，不编码）
    const canonicalQueryString = this._formatQuery(queryParams);
    
    // 构建 canonical request
    const payloadHash = xContentSha256;
    const canonicalRequest = [
      method,
      uri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    
    // 构建 string to sign
    const algorithm = 'HMAC-SHA256';
    const canonicalRequestHash = this._hash(canonicalRequest);
    const stringToSign = [
      algorithm,
      date,
      credentialScope,
      canonicalRequestHash
    ].join('\n');
    
    // 生成签名密钥链
    const kDate = this._hmacDigest(this.apiSecret, datestamp);
    const kRegion = this._hmacDigest(kDate, this.region);
    const kService = this._hmacDigest(kRegion, this.service);
    const kSigning = this._hmacDigest(kService, 'request');
    
    // 计算签名
    const signature = this._hmacDigest(kSigning, stringToSign).toString('hex');
    
    // 构建 Authorization header
    const credential = `${this.apiKey}/${credentialScope}`;
    const authorization = `${algorithm} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return { authorization, date, xContentSha256 };
  }

  /**
   * 生成图片（单个）
   * @param {string} prompt - 图片生成提示词
   * @param {string} outputPath - 输出路径
   * @param {object} options - 选项
   */
  async generateImage(prompt, outputPath, options = {}) {
    const {
      referenceImage = null,
      width = 1920,
      height = 1080
    } = options;

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('即梦 API Key 或 Secret 未配置，请在 .env 文件中设置 JIMENG_API_KEY 和 JIMENG_API_SECRET');
    }

    try {
      // 构建请求体
      const requestBody = {
        req_key: this.reqKey,
        prompt: prompt,
        width: width,
        height: height,
        num_images: 1,
        seed: Math.floor(Math.random() * 1000000)
      };

      // 如果有参考图片，添加参考图片
      if (referenceImage && fs.existsSync(referenceImage)) {
        const imageData = fs.readFileSync(referenceImage);
        const base64Image = imageData.toString('base64');
        requestBody.binary_data_base64 = [base64Image];
      }

      const bodyStr = JSON.stringify(requestBody);
      const uri = '/';
      const method = 'POST';
      
      // 查询参数
      const queryParams = {
        Action: 'CVProcess',
        Version: '2022-08-31'
      };

      // 从 endpoint 提取 host
      const urlObj = new URL(this.endpoint);
      const host = urlObj.hostname;
      
      // 计算请求体的 SHA256
      const xContentSha256 = this._hash(bodyStr);
      
      const headers = {
        'Content-Type': 'application/json',
        'host': host,
        'X-Content-SHA256': xContentSha256
      };

      // 生成签名（参考 volcengine.ts 的逻辑）
      const date = this._getTime();
      const datestamp = date.substring(0, 8);
      const credentialScope = `${datestamp}/${this.region}/${this.service}/request`;
      
      const signResult = this._signRequest(method, uri, queryParams, headers, bodyStr, credentialScope);
      headers['X-Date'] = signResult.date;
      headers['Authorization'] = signResult.authorization;

      // 构建查询字符串
      const queryString = this._formatQuery(queryParams);

      // 发送请求
      const url = `${this.endpoint}${uri}?${queryString}`;
      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: bodyStr
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`即梦 API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      // 提取图片数据
      let imageData = null;
      if (result.data && result.data.images && result.data.images.length > 0) {
        imageData = result.data.images[0].image || result.data.images[0];
      } else if (result.image) {
        imageData = result.image;
      } else if (result.data) {
        imageData = result.data;
      }

      if (!imageData) {
        throw new Error('即梦 API 返回数据格式错误，未找到图片数据');
      }

      // 保存图片
      const imageBuffer = Buffer.from(imageData, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      
      return outputPath;
    } catch (error) {
      console.error('即梦图片生成错误:', error);
      throw error;
    }
  }

  /**
   * 提交异步任务
   * @param {object} requestBody - 请求体
   * @returns {Promise<string>} task_id
   */
  async _submitTask(requestBody) {
    const bodyStr = JSON.stringify(requestBody);
    const uri = '/';
    const method = 'POST';

    // 查询参数（使用 CVSync2AsyncSubmitTask）
    const queryParams = {
      Action: 'CVSync2AsyncSubmitTask',
      Version: '2022-08-31'
    };

    // 从 endpoint 提取 host
    const urlObj = new URL(this.endpoint);
    const host = urlObj.hostname;
    
    // 先计算 X-Content-SHA256 和 X-Date
    const date = this._getTime();
    const xContentSha256 = this._hash(bodyStr);
    const datestamp = date.substring(0, 8);
    const credentialScope = `${datestamp}/${this.region}/${this.service}/request`;
    
    // 构建 headers
    const headers = {
      'Content-Type': 'application/json',
      'host': host.toLowerCase(),
      'X-Content-SHA256': xContentSha256,
      'X-Date': date
    };

    // 生成签名
    const signResult = this._signRequest(method, uri, queryParams, headers, bodyStr, credentialScope);
    headers['Authorization'] = signResult.authorization;

    // 构建查询字符串
    const queryStringForUrl = this._formatQueryForUrl(queryParams);

    // 发送请求
    const url = `${this.endpoint}${uri}?${queryStringForUrl}`;
    const response = await fetch(url, {
      method: method,
      headers: headers,
      body: bodyStr
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`即梦 API 提交任务失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.code !== 10000 || !result.data?.task_id) {
      throw new Error(`即梦 API 返回错误: ${result.message || JSON.stringify(result)}`);
    }

    return result.data.task_id;
  }

  /**
   * 查询任务结果
   * @param {string} taskId - 任务ID
   * @param {boolean} returnUrl - 是否返回URL
   * @returns {Promise<object>} 任务结果
   */
  async _getTaskResult(taskId, returnUrl = false) {
    const requestBody = {
      req_key: this.reqKey,
      task_id: taskId
    };

    if (returnUrl) {
      requestBody.req_json = JSON.stringify({ return_url: true });
    }

    const bodyStr = JSON.stringify(requestBody);
    const uri = '/';
    const method = 'POST';

    // 查询参数（使用 CVSync2AsyncGetResult）
    const queryParams = {
      Action: 'CVSync2AsyncGetResult',
      Version: '2022-08-31'
    };

    // 从 endpoint 提取 host
    const urlObj = new URL(this.endpoint);
    const host = urlObj.hostname;
    
    // 先计算 X-Content-SHA256 和 X-Date
    const date = this._getTime();
    const xContentSha256 = this._hash(bodyStr);
    const datestamp = date.substring(0, 8);
    const credentialScope = `${datestamp}/${this.region}/${this.service}/request`;
    
    // 构建 headers
    const headers = {
      'Content-Type': 'application/json',
      'host': host.toLowerCase(),
      'X-Content-SHA256': xContentSha256,
      'X-Date': date
    };

    // 生成签名
    const signResult = this._signRequest(method, uri, queryParams, headers, bodyStr, credentialScope);
    headers['Authorization'] = signResult.authorization;

    // 构建查询字符串
    const queryStringForUrl = this._formatQueryForUrl(queryParams);

    // 发送请求
    const url = `${this.endpoint}${uri}?${queryStringForUrl}`;
    const response = await fetch(url, {
      method: method,
      headers: headers,
      body: bodyStr
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`即梦 API 查询任务失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.code !== 10000) {
      throw new Error(`即梦 API 返回错误: ${result.message || JSON.stringify(result)}`);
    }

    return result.data;
  }

  /**
   * 批量生成图片（一次调用生成多张）
   * 根据即梦 API 文档，使用异步任务方式，一次调用生成所有图片
   * @param {Array<string>} prompts - 提示词数组
   * @param {string} outputDir - 输出目录
   * @param {object} options - 选项
   * @returns {Promise<Array<string>>} 生成的图片路径数组
   */
  async generateBatchImages(prompts, outputDir, options = {}) {
    const {
      referenceImage = null,
      width = 1920,
      height = 1080,
      prefix = 'shot'
    } = options;

    if (!this.apiKey || !this.apiSecret) {
      throw new Error('即梦 API Key 或 Secret 未配置，请在 .env 文件中设置 JIMENG_API_KEY 和 JIMENG_API_SECRET');
    }

    console.log(`📸 开始批量生成 ${prompts.length} 张图片（一次调用）...\n`);

    // 将所有提示词合并成一个 prompt
    // 根据文档，模型会根据 prompt 理解意图判断输出图片数量
    // 我们可以在 prompt 中明确指定要生成多少张图片
    const combinedPrompt = this._combinePrompts(prompts);
    
    console.log(`📝 合并后的提示词长度: ${combinedPrompt.length} 字符\n`);

    // 构建请求体（按照即梦 API 文档格式）
    const requestBody = {
      req_key: this.reqKey,  // jimeng_t2i_v40
      prompt: combinedPrompt,
      width: width,
      height: height
      // 不设置 force_single，让模型根据 prompt 生成多张图片
      // 根据文档：最大输出图数量 = 15 - 输入图数量
    };

    // 如果有参考图片，添加参考图片
    // 根据文档，即梦 API 使用 image_urls 参数（URL数组）
    // 但根据 volcengine.ts 的实现，视频生成使用 binary_data_base64
    // 这里尝试两种方式：
    // 1. 先尝试使用 binary_data_base64（参考视频生成的实现）
    // 2. 如果不行，再尝试使用 image_urls 的 data URL 格式
    if (referenceImage && fs.existsSync(referenceImage)) {
      console.log(`📸 使用参考图片: ${path.basename(referenceImage)}`);
      
      try {
        const imageData = fs.readFileSync(referenceImage);
        const base64Image = imageData.toString('base64');
        
        // 方案1：使用 binary_data_base64（参考 volcengine.ts 中视频生成的实现）
        // 视频生成使用这个参数，图片生成可能也支持
        requestBody.binary_data_base64 = [base64Image];
        console.log('  ✅ 参考图片已添加（binary_data_base64格式）\n');
        
        // 注意：如果 API 返回错误说需要 image_urls，可以尝试以下备选方案：
        // const ext = path.extname(referenceImage).toLowerCase();
        // const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        // const dataUrl = `data:${mimeType};base64,${base64Image}`;
        // requestBody.image_urls = [dataUrl];
      } catch (error) {
        console.warn(`  ⚠️  读取参考图片失败: ${error.message}`);
      }
    }

    // 提交任务
    console.log('📤 提交批量生成任务...');
    const taskId = await this._submitTask(requestBody);
    console.log(`✅ 任务已提交，task_id: ${taskId}\n`);

    // 轮询查询结果
    console.log('⏳ 等待任务完成...');
    let result = null;
    let retries = 0;
    const maxRetries = 120; // 最多等待 10 分钟（每次等待 5 秒）
    
    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒
      
      result = await this._getTaskResult(taskId, false); // 不返回 URL，返回 base64
      
      if (result.status === 'done') {
        break;
      } else if (result.status === 'not_found' || result.status === 'expired') {
        throw new Error(`任务 ${taskId} 未找到或已过期`);
      } else if (result.status === 'in_queue' || result.status === 'generating') {
        if (retries % 6 === 0) { // 每 30 秒打印一次
          console.log(`  ⏳ 任务处理中... (已等待 ${Math.floor((retries + 1) * 5 / 60)} 分钟)`);
        }
        retries++;
        continue;
      }
      
      retries++;
    }

    if (!result || result.status !== 'done') {
      throw new Error(`任务 ${taskId} 处理超时`);
    }

    // 提取图片数据
    const images = result.binary_data_base64 || [];
    if (images.length === 0) {
      throw new Error('未找到生成的图片数据');
    }

    console.log(`✅ 任务完成，共生成 ${images.length} 张图片\n`);

    // 保存所有图片
    const outputPaths = [];
    const expectedCount = prompts.length;
    const actualCount = images.length;
    
    if (actualCount < expectedCount) {
      console.warn(`⚠️  期望生成 ${expectedCount} 张图片，实际生成 ${actualCount} 张图片`);
    }

    for (let i = 0; i < Math.min(actualCount, expectedCount); i++) {
      const imageData = images[i];
      const outputPath = path.join(outputDir, `${prefix}_${i + 1}.png`);
      const imageBuffer = Buffer.from(imageData, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      outputPaths.push(outputPath);
      console.log(`  ✅ 已保存: ${path.basename(outputPath)}`);
    }
    
    console.log(`\n✅ 批量生成完成，共保存 ${outputPaths.length} 张图片\n`);
    
    return outputPaths;
  }

  /**
   * 合并多个提示词为一个 prompt
   * 根据即梦 API 文档，模型会根据 prompt 理解意图生成多张图片
   * @param {Array<string>} prompts - 提示词数组
   * @returns {string} 合并后的提示词
   */
  _combinePrompts(prompts) {
    // 方案：将所有提示词合并，明确告诉模型要生成多少张不同的图片
    const parts = [
      `请生成 ${prompts.length} 张不同的图片，每张图片对应以下场景：`,
      ''
    ];

    prompts.forEach((prompt, index) => {
      parts.push(`图片 ${index + 1}: ${prompt}`);
    });

    parts.push('');
    parts.push(`要求：`);
    parts.push(`1. 总共生成 ${prompts.length} 张不同的图片`);
    parts.push(`2. 每张图片必须对应其对应的场景描述`);
    parts.push(`3. 图片之间要有明显的视觉差异`);
    parts.push(`4. 保持统一的视觉风格和角色一致性`);

    return parts.join('\n');
  }
}

export default new JimengClient();
