import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  jimeng: {
    apiKey: process.env.JIMENG_API_KEY || '',
    apiSecret: process.env.JIMENG_API_SECRET || '',
    endpoint: process.env.JIMENG_ENDPOINT || 'https://visual.volcengineapi.com',
    reqKey: process.env.JIMENG_REQ_KEY || 'jimeng_t2i_v40', // 即梦 API 的 req_key 参数
  },
  paths: {
    input: process.env.INPUT_DIR || join(__dirname, '../input'),
    output: process.env.OUTPUT_DIR || join(__dirname, '../output'),
    temp: process.env.TEMP_DIR || join(__dirname, '../temp'),
  },
  video: {
    duration: 30, // 30秒视频
    fps: 30,
    width: 1920,
    height: 1080,
  },
};

// 确保目录存在
[config.paths.input, config.paths.output, config.paths.temp].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

export default config;

