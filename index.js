import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import config from './config/config.js';

// 导入所有 Agents
import musicStoryboardGenerator from './agents/music-storyboard-generator.js';
import keyframeGenerator from './agents/keyframe-generator.js';
import videoGenerator from './agents/video-generator.js';
import videoComposer from './agents/video-composer.js';


/**
 * 检查 FFmpeg 是否可用
 */
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

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
  
  // 读取目录中的所有文件
  const files = fs.readdirSync(keyframesDir);
  
  // 解析文件名，提取关键帧信息
  // 新格式：shot_{shotNumber}.png，每个镜头一个关键帧
  const keyframeMap = new Map(); // shotNumber -> path
  
  files.forEach(file => {
    // 匹配格式：shot_{shotNumber}.png
    const match = file.match(/^shot_(\d+)\.png$/i);
    if (match) {
      const shotNumber = parseInt(match[1]);
      const filePath = path.join(keyframesDir, file);
      keyframeMap.set(shotNumber, filePath);
    }
  });
  
  if (keyframeMap.size === 0) {
    throw new Error(`在 ${keyframesDir} 中未找到关键帧文件（格式：shot_{数字}.png）`);
  }
  
  // 根据 storyboard 构建 keyframeData
  const shots = storyboard.storyboard.shots || [];
  const keyframes = [];
  
  // 按 shotNumber 排序
  const sortedShotNumbers = Array.from(keyframeMap.keys()).sort((a, b) => a - b);
  
  sortedShotNumbers.forEach(shotNumber => {
    const shot = shots.find(s => s.shotNumber === shotNumber);
    const nextShot = shots.find(s => s.shotNumber === shotNumber + 1);
    
    if (!shot) {
      console.warn(`   ⚠️  未找到镜头 ${shotNumber} 的分镜信息，将使用默认值`);
    }
    
    // 当前镜头的关键帧（也是起始帧）
    const currentKeyframePath = keyframeMap.get(shotNumber);
    if (!currentKeyframePath) {
      console.warn(`   ⚠️  镜头 ${shotNumber} 缺少关键帧文件`);
      return;
    }
    
    // 下一个镜头的关键帧（也是当前镜头的结束帧）
    const nextKeyframePath = keyframeMap.get(shotNumber + 1);
    
    // 构建关键帧对象
    const keyframeA = {
      path: currentKeyframePath,
      url: `file://${currentKeyframePath}`,
      prompt: shot?.prompt || `Shot ${shotNumber} start keyframe`,
    };
    
    // keyframeB 使用下一个镜头的关键帧（如果存在）
    const keyframeB = nextKeyframePath ? {
      path: nextKeyframePath,
      url: `file://${nextKeyframePath}`,
      prompt: nextShot?.prompt || `Shot ${shotNumber} end keyframe (Shot ${shotNumber + 1} start)`,
      nextShotNumber: nextShot?.shotNumber || null,
    } : {
      path: currentKeyframePath, // 最后一个镜头，使用当前关键帧作为结束帧
      url: `file://${currentKeyframePath}`,
      prompt: shot?.prompt || `Shot ${shotNumber} end keyframe`,
      nextShotNumber: null,
    };
    
    keyframes.push({
      shotNumber: shotNumber,
      timeRange: shot?.timeRange || `${shotNumber}-${shotNumber + 1}`,
      startTime: shot?.startTime || 0,
      endTime: shot?.endTime || 0,
      keyframeA: keyframeA,
      keyframeB: keyframeB,
      shot: shot || {
        shotNumber: shotNumber,
        timeRange: `${shotNumber}-${shotNumber + 1}`,
        startTime: 0,
        endTime: 0,
      },
      nextShot: nextShot || null,
    });
    
    if (nextKeyframePath) {
      console.log(`   ✅ 镜头 ${shotNumber}: 关键帧已加载（起始: shot_${shotNumber}.png，结束: shot_${shotNumber + 1}.png）`);
    } else {
      console.log(`   ✅ 镜头 ${shotNumber}: 关键帧已加载（起始: shot_${shotNumber}.png，结束: shot_${shotNumber}.png）`);
    }
  });
  
  console.log(`   ✅ 共加载 ${keyframes.length} 个镜头的关键帧\n`);
  
  return {
    storyboard: storyboard,
    keyframes: keyframes,
    timestamp: new Date().toISOString(),
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 从 input 文件夹查找音频文件
 */
function findAudioFile(inputDir) {
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'];
  const files = fs.readdirSync(inputDir);
  
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (audioExtensions.includes(ext)) {
      return path.join(inputDir, file);
    }
  }
  
  return null;
}

/**
 * 从 input 文件夹查找歌词文件
 */
function findLyricsFile(inputDir, audioFileName = null) {
  const lyricsExtensions = ['.txt', '.lrc'];
  
  // 如果提供了音频文件名，尝试查找同名歌词文件
  if (audioFileName) {
    const baseName = path.basename(audioFileName, path.extname(audioFileName));
    for (const ext of lyricsExtensions) {
      const lyricsPath = path.join(inputDir, `${baseName}${ext}`);
      if (fs.existsSync(lyricsPath)) {
        return lyricsPath;
      }
    }
  }
  
  // 查找通用的歌词文件
  const commonNames = ['lyrics.txt', 'lyrics.lrc', '歌词.txt'];
  for (const name of commonNames) {
    const lyricsPath = path.join(inputDir, name);
    if (fs.existsSync(lyricsPath)) {
      return lyricsPath;
    }
  }
  
  // 查找任意 .txt 或 .lrc 文件
  const files = fs.readdirSync(inputDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (lyricsExtensions.includes(ext)) {
      return path.join(inputDir, file);
    }
  }
  
  return null;
}

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
    // const storyboardData1 = await musicStoryboardGenerator.generate(audioPath, lyricsText);
    // console.log(`   情感: ${storyboardData1.musicAnalysis?.emotion?.primary || '未知'}`);
    // console.log(`   主题: ${storyboardData1.musicAnalysis?.theme?.mainTheme || '未知'}`);
    // console.log(`   风格: ${storyboardData1.visualConcept?.style?.name || '未知'}`);
    // console.log(`   镜头数: ${storyboardData1.storyboard?.shots?.length || 0} 个`);
    // console.log(`   视频时长: ${storyboardData1.storyboard?.totalDuration || 0} 秒\n`);
    
    // // 保存 Agent 1 的结果到 output 文件夹
    // const agent1Timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // const agent1ResultPath = path.join(config.paths.output, `agent1_storyboard_${agent1Timestamp}.json`);
    // fs.writeFileSync(agent1ResultPath, JSON.stringify(storyboardData1, null, 2), 'utf-8');
    // console.log(`📄 Agent 1 结果已保存: ${agent1ResultPath}\n`);
    
    // storyboardData从内存导入
    const storyboardData = JSON.parse(fs.readFileSync('output/agent1_storyboard_2025-11-14T11-35-24-761Z.json', 'utf-8'));
    // 构建 storyboard 对象以兼容后续流程
    const storyboard = {
      storyboard: storyboardData.storyboard,
      visualConcept: storyboardData.visualConcept,
      musicAnalysis: storyboardData.musicAnalysis,
      timestamp: storyboardData.timestamp,
    };
    
    // 阶段二：素材生成
    console.log('📋 阶段二：素材生成\n');
    
    // Agent 4: 关键帧生成器（生成 AB 关键帧）
    // const keyframeData = await keyframeGenerator.generate(storyboard);
    // console.log(`   关键帧: ${keyframeData.keyframes?.length || 0} 个镜头，共 ${(keyframeData.keyframes?.length || 0) * 2} 个关键帧\n`);
    
    // 临时：从目录读取关键帧
    const keyframeData = loadKeyframesFromDirectory(storyboard);
    console.log(`   关键帧: ${keyframeData.keyframes?.length || 0} 个镜头，共 ${(keyframeData.keyframes?.length || 0) * 2} 个关键帧（从目录加载）\n`);
    
    // Agent 5: 视频生成器（基于 AB 关键帧生成视频）
    const materials = await videoGenerator.generate(keyframeData);
    console.log(`   视频素材: ${materials.materials?.length || 0} 个\n`);
    
    // 阶段三：视频合成与输出
    console.log('📋 阶段三：视频合成与输出\n');
    
    // Agent 2: 视频合成器（合并了剪辑、调色、音频混音和渲染）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalOutputPath = path.join(config.paths.output, `music_video_${timestamp}.mp4`);
    const finalVideo = await videoComposer.compose(
      materials.materials, 
      audioPath, 
      finalOutputPath,
      { visualConcept: storyboardData.visualConcept }
    );
    
    // 保存工作流结果（只保存每个 agent 的核心输出）
    const workflowResult = {
      // Agent 1: 音乐分析与分镜生成器（合并了音乐分析、视觉概念和分镜脚本）
      musicAnalysis: {
        audioInfo: storyboardData.audioInfo,
        bpmInfo: storyboardData.bpmInfo,
        analysis: storyboardData.musicAnalysis,
        timestamp: storyboardData.timestamp,
        analysisMethod: storyboardData.analysisMethod,
      },
      visualConcept: storyboardData.visualConcept,
      storyboard: storyboardData.storyboard,
      // Agent 4: 关键帧生成器（只保存关键帧信息，不包含 storyboard）
      keyframes: (keyframeData.keyframes || []).map(kf => ({
        shotNumber: kf.shotNumber,
        timeRange: kf.timeRange,
        startTime: kf.startTime,
        endTime: kf.endTime,
        keyframeA: {
          path: kf.keyframeA.path,
          url: kf.keyframeA.url,
          prompt: kf.keyframeA.prompt,
        },
        keyframeB: {
          path: kf.keyframeB.path,
          url: kf.keyframeB.url,
          prompt: kf.keyframeB.prompt,
          nextShotNumber: kf.keyframeB.nextShotNumber,
        },
      })),
      // Agent 5: 视频生成器（只保存素材信息，不包含 keyframeData）
      materials: (materials.materials || []).map(m => ({
        shotNumber: m.shotNumber,
        timeRange: m.timeRange,
        startTime: m.startTime,
        endTime: m.endTime,
        type: m.type,
        path: m.path,
        status: m.status,
        error: m.error,
        prompt: m.prompt,
      })),
      // Agent 2: 视频合成器（合并了剪辑、调色、音频混音和渲染）
      finalVideo: {
        outputPath: finalVideo.outputPath,
        audioPath: finalVideo.audioPath,
        timestamp: finalVideo.timestamp,
      },
      timestamp: new Date().toISOString(),
    };
    
    const resultPath = path.join(config.paths.output, `workflow_result_${timestamp}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(workflowResult, null, 2));
    
    // 保存关键帧URL列表到单独文件
    if (keyframeData.keyframes && keyframeData.keyframes.length > 0) {
      const keyframesInfo = keyframeData.keyframes.map(kf => ({
        shotNumber: kf.shotNumber,
        timeRange: kf.timeRange,
        keyframeA: {
          url: kf.keyframeA.url,
          path: kf.keyframeA.path,
          prompt: kf.keyframeA.prompt,
        },
        keyframeB: {
          url: kf.keyframeB.url,
          path: kf.keyframeB.path,
          prompt: kf.keyframeB.prompt,
          nextShotNumber: kf.keyframeB.nextShotNumber,
        },
      }));
      const keyframesPath = path.join(config.paths.output, `keyframes_info_${timestamp}.json`);
      fs.writeFileSync(keyframesPath, JSON.stringify(keyframesInfo, null, 2));
      console.log(`📸 关键帧信息: ${keyframesPath}`);
    }
    
    console.log('\n🎉 视频制作完成！');
    console.log(`📁 最终视频: ${finalOutputPath}`);
    console.log(`📄 工作流结果: ${resultPath}`);
    if (keyframeData.keyframes && keyframeData.keyframes.length > 0) {
      const totalKeyframes = keyframeData.keyframes.length * 2;
      console.log(`📸 关键帧: ${keyframeData.keyframes.length} 个镜头，共 ${totalKeyframes} 个关键帧（A+B）`);
      console.log(`📁 关键帧目录: ${path.join(config.paths.output, 'keyframes')}`);
    }
    
  } catch (error) {
    console.error('\n❌ 工作流执行失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行主函数
main();

