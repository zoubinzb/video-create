/**
 * 测试环境设置脚本
 * 检查必要的依赖和配置
 */

import fs from 'fs';
import { execSync } from 'child_process';
import config from './config/config.js';

console.log('🔍 检查环境配置...\n');

let hasError = false;

// 检查 .env 文件
console.log('1. 检查环境变量配置...');
if (!fs.existsSync('.env')) {
  console.log('   ⚠️  .env 文件不存在');
  console.log('   💡 请复制 .env.example 为 .env 并填入 API Key');
  hasError = true;
} else {
  const envContent = fs.readFileSync('.env', 'utf-8');
  if (!envContent.includes('GEMINI_API_KEY=') || envContent.includes('your_gemini_api_key')) {
    console.log('   ⚠️  GEMINI_API_KEY 未配置或使用默认值');
    hasError = true;
  } else {
    console.log('   ✅ .env 配置正确');
  }
}

// 检查 FFmpeg
console.log('\n2. 检查 FFmpeg...');
try {
  const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf-8', stdio: 'pipe' });
  if (ffmpegVersion.includes('ffmpeg version')) {
    console.log('   ✅ FFmpeg 已安装');
    const versionMatch = ffmpegVersion.match(/ffmpeg version (\S+)/);
    if (versionMatch) {
      console.log(`   📦 版本: ${versionMatch[1]}`);
    }
  }
} catch (error) {
  console.log('   ❌ FFmpeg 未安装或未添加到 PATH');
  console.log('   💡 请安装 FFmpeg:');
  console.log('      Windows: 下载并添加到 PATH');
  console.log('      macOS: brew install ffmpeg');
  console.log('      Linux: sudo apt install ffmpeg');
  hasError = true;
}

// 检查目录
console.log('\n3. 检查目录结构...');
const dirs = [config.paths.input, config.paths.output, config.paths.temp];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✅ 创建目录: ${dir}`);
  } else {
    console.log(`   ✅ 目录存在: ${dir}`);
  }
});

// 检查 input 目录中是否有文件
console.log('\n4. 检查输入文件...');
try {
  const inputFiles = fs.readdirSync(config.paths.input);
  const audioFiles = inputFiles.filter(f => {
    const ext = f.toLowerCase();
    return ext.endsWith('.mp3') || ext.endsWith('.wav') || ext.endsWith('.m4a') || 
           ext.endsWith('.flac') || ext.endsWith('.aac') || ext.endsWith('.ogg');
  });
  
  if (audioFiles.length > 0) {
    console.log(`   ✅ 找到 ${audioFiles.length} 个音频文件`);
    audioFiles.slice(0, 3).forEach(f => console.log(`      - ${f}`));
    if (audioFiles.length > 3) {
      console.log(`      ... 还有 ${audioFiles.length - 3} 个文件`);
    }
  } else {
    console.log(`   ⚠️  input 文件夹中没有音频文件`);
    console.log(`   💡 请将音乐文件放入 ${config.paths.input} 文件夹`);
  }
} catch (error) {
  console.log(`   ⚠️  无法读取 input 目录`);
}

// 检查 Node.js 版本
console.log('\n5. 检查 Node.js 版本...');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log(`   ✅ Node.js 版本: ${nodeVersion}`);
} else {
  console.log(`   ⚠️  Node.js 版本: ${nodeVersion} (建议 18+)`);
}

// 总结
console.log('\n' + '='.repeat(50));
if (hasError) {
  console.log('❌ 环境检查未通过，请修复上述问题后重试');
  process.exit(1);
} else {
  console.log('✅ 环境检查通过，可以开始使用！');
  console.log('\n使用方法:');
  console.log('  1. 将音乐文件放入 input/ 文件夹');
  console.log('  2. （可选）将歌词文件放入 input/ 文件夹');
  console.log('  3. 运行: node index.js');
}

