import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import config from './config/config.js';
import { findAudioFile, findLyricsFile } from './utils/utils.js';
// 导入所有 Agents
import musicStoryboardGenerator from './agents/gemini/music-storyboard-generator.js';
import keyframeGenerator from './agents/gemini/keyframe-generator.js';
import musicStoryboardGeneratorDoubao from './agents/doubao/music-storyboard-generator-doubao.js';
import keyframeGeneratorJimeng from './agents/jimeng/keyframe-generator-jimeng.js';
import videoGenerator from './agents/gemini/video-generator.js';
import videoGeneratorAliyun from './agents/aliyun/video-generator-aliyun.js';
import videoGeneratorImageToVideo from './agents/gemini/video-generator-image-to-video.js';
import videoComposer from './agents/video-composer.js';



/**
 * 从 output/keyframes 目录读取关键帧文件
 * @param {object} storyboard - 分镜脚本对象
 * @returns {object} keyframeData - 关键帧数据，格式与 keyframeGenerator.generate() 相同
 */
function loadKeyframesFromDirectory(storyboard) {
  console.log('📸 从目录读取关键帧文件...');
  
  const keyframesDir = path.join(config.paths.output, 'keyframes');
  if (!fs.existsSync(keyframesDir)) {
    throw new Error(`关键帧目录不存在: ${keyframesDir}`);
  }
  
  // 解析关键帧文件，构建 shotNumber -> path 映射
  const keyframeMap = new Map();
  fs.readdirSync(keyframesDir).forEach(file => {
    const match = file.match(/^shot_(\d+)\.png$/i);
    if (match) {
      keyframeMap.set(parseInt(match[1]), path.join(keyframesDir, file));
    }
  });
  
  const shots = storyboard.storyboard.shots || [];
  const createKeyframe = (framePath, prompt) => ({
    path: framePath,
    url: `file://${framePath}`,
    prompt
  });
  
  // 构建关键帧数据
  const keyframes = Array.from(keyframeMap.keys())
    .sort((a, b) => a - b)
    .map(shotNumber => {
      const shot = shots.find(s => s.shotNumber === shotNumber);
      const nextShot = shots.find(s => s.shotNumber === shotNumber + 1);
      const currentPath = keyframeMap.get(shotNumber);
      const nextPath = keyframeMap.get(shotNumber + 1);
      
      if (!shot) console.warn(`   ⚠️  未找到镜头 ${shotNumber} 的分镜信息`);
      
      return {
        shotNumber,
        timeRange: shot?.timeRange || `${shotNumber}-${shotNumber + 1}`,
        startTime: shot?.startTime || 0,
        endTime: shot?.endTime || 0,
        keyframeA: createKeyframe(currentPath, shot?.prompt || `Shot ${shotNumber} start`),
        keyframeB: nextPath 
          ? { ...createKeyframe(nextPath, nextShot?.prompt || `Shot ${shotNumber} end`), nextShotNumber: nextShot?.shotNumber }
          : createKeyframe(currentPath, shot?.prompt || `Shot ${shotNumber} end`),
        shot: shot || { shotNumber, timeRange: `${shotNumber}-${shotNumber + 1}`, startTime: 0, endTime: 0 },
        nextShot
      };
    });
  
  console.log(`   ✅ 共加载 ${keyframes.length} 个镜头的关键帧\n`);
  
  return {
    storyboard,
    keyframes,
    timestamp: new Date().toISOString()
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// 音乐分析模式常量定义
const MUSIC_ANALYSIS_MODE_AI = {
  GEMINI: 'gemini',
  DOUBAO: 'doubao',
};



// 关键帧生成模式常量定义
const KEYFRAME_GENERATION_MODE_AI = {
  GEMINI: 'gemini',
  JIMENG: 'jimeng',
};

// 视频生成模式常量定义
const VIDEO_GENERATION_MODE_AI = {
  GEMINI_FIRST_LAST: 'gemini_first_last', // Gemini Veo 首尾帧率视频模式
  GEMINI_IMAGE_TO_VIDEO: 'gemini_image_to_video', // Gemini Veo 图生视频模式
  ALIYUN: 'aliyun', // 阿里万象首尾帧率视频模式
};
// const MUSIC_ANALYSIS_MODE_DEFAULT = MUSIC_ANALYSIS_MODE_AI.GEMINI;
// const KEYFRAME_GENERATION_MODE_DEFAULT = KEYFRAME_GENERATION_MODE_AI.GEMINI;
// const VIDEO_GENERATION_MODE_DEFAULT = VIDEO_GENERATION_MODE_AI.GEMINI_IMAGE_TO_VIDEO;

const MUSIC_ANALYSIS_MODE_DEFAULT = '';
const KEYFRAME_GENERATION_MODE_DEFAULT = '';
const VIDEO_GENERATION_MODE_DEFAULT = '';

/**
 * 主工作流
 */
async function main() {
  console.log('🎵 AI Agents 全流程音乐视频制作系统');
  console.log('=====================================\n');
  
  // 从 input 文件夹读取文件
  const inputDir = config.paths.input;
  
  if (!fs.existsSync(inputDir)) {
    console.error(`❌ 输入文件夹不存在: ${inputDir}`);
    console.error(`💡 请创建 input 文件夹并放入音乐文件`);
    process.exit(1);
  }
  
  // 查找音频文件
  const audioPath = findAudioFile(inputDir);
  if (!audioPath) {
    console.error(`❌ 在 ${inputDir} 中未找到音频文件`);
    console.error(`💡 支持的格式: .mp3, .wav, .m4a, .flac, .aac, .ogg`);
    process.exit(1);
  }
  
  console.log(`🎵 找到音频文件: ${path.basename(audioPath)}`);
  
  // 查找歌词文件（可选）
  const lyricsPath = findLyricsFile(inputDir, audioPath);
  let lyricsText = null;
  if (lyricsPath) {
    lyricsText = fs.readFileSync(lyricsPath, 'utf-8');
    console.log(`📝 找到歌词文件: ${path.basename(lyricsPath)}\n`);
  } else {
    console.log(`📝 未找到歌词文件，将仅基于音频进行分析\n`);
  }
  
  try {
    // 阶段一：音乐分析与分镜生成
    console.log('📋 阶段一：音乐分析与分镜生成\n');
    // Agent 1: 音乐分析与分镜生成器（合并了音乐分析、视觉概念和分镜脚本）
    let storyboardData;

    switch (MUSIC_ANALYSIS_MODE_DEFAULT) {
      case MUSIC_ANALYSIS_MODE_AI.GEMINI:
        storyboardData = await musicStoryboardGenerator.generate(audioPath, lyricsText);
        break;
      case MUSIC_ANALYSIS_MODE_AI.JIMENG:
        storyboardData = await musicStoryboardGeneratorDoubao.generate(audioPath, lyricsText);
        break;
    }
    const agent1ResultPath =  path.join(config.paths.output, `agent1_storyboard.json`);

    { // 使用的数据从缓存导入，便于各agent 分离
      storyboardData = JSON.parse(fs.readFileSync(agent1ResultPath, 'utf-8'));
    }
        
    // 构建 storyboard 对象以兼容后续流程
    const storyboard = {
      storyboard: storyboardData.storyboard,
      visualConcept: storyboardData.visualConcept,
      musicAnalysis: storyboardData.musicAnalysis,
      timestamp: storyboardData.timestamp,
    };
    
    // Agent 2: 素材生成
    console.log('📋 阶段二：素材生成\n');
    
    // Agent 4: 关键帧生成器（生成 AB 关键帧）
    let keyframeData;

    switch (KEYFRAME_GENERATION_MODE_DEFAULT) {
      case KEYFRAME_GENERATION_MODE_AI.GEMINI:
        keyframeData = await keyframeGenerator.generate(storyboard);
        break;
      case KEYFRAME_GENERATION_MODE_AI.DOUBAO:
        keyframeData = await keyframeGeneratorJimeng.generate(storyboard);
        break;
    }
  


    // 方案四：从已有目录加载关键帧
    keyframeData = loadKeyframesFromDirectory(storyboard);
    console.log(`   关键帧: ${keyframeData.keyframes?.length || 0} 个镜头，共 ${(keyframeData.keyframes?.length || 0) * 2} 个关键帧（从目录加载）\n`);

  
    // Agent 5/6: 视频生成器
    let materials;
    switch (VIDEO_GENERATION_MODE_DEFAULT) {
      case VIDEO_GENERATION_MODE_AI.GEMINI_FIRST_LAST:
        materials = await videoGenerator.generate(keyframeData);
        break;
      case VIDEO_GENERATION_MODE_AI.GEMINI_IMAGE_TO_VIDEO:
        materials = await videoGeneratorImageToVideo.generate(keyframeData);
        break;
      case VIDEO_GENERATION_MODE_AI.ALIYUN:
        materials = await videoGeneratorAliyun.generate(keyframeData);
        break;
    }

    
    // 阶段三：视频合成与输出
    console.log('📋 阶段三：视频合成与输出\n');
    
    // Agent 2: 视频合成器（合并了剪辑、调色、音频混音和渲染）
    const finalOutputPath = path.join(config.paths.output, `music_video.mp4`);
    const tempDir = config.paths.temp || path.join(process.cwd(), 'temp');
    await videoComposer.compose(
      tempDir, // 直接传递 temp 目录路径
      audioPath, 
      finalOutputPath,
      { 
        visualConcept: storyboardData.visualConcept,
        storyboard: storyboardData.storyboard
      }
    );
    
    console.log('\n🎉 视频制作完成！');
    console.log(`📁 最终视频: ${finalOutputPath}`);

  } catch (error) {
    console.error('\n❌ 工作流执行失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主函数
main();

