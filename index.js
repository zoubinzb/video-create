import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import config from './config/config.js';

// 导入所有 Agents
import musicAnalyst from './agents/music-analyst.js';
import visualConceptGenerator from './agents/visual-concept-generator.js';
import storyboardMaster from './agents/storyboard-master.js';
import keyframeGenerator from './agents/keyframe-generator.js';
import videoGenerator from './agents/video-generator.js';
import smartEditor from './agents/smart-editor.js';
import visualFXColorist from './agents/visual-fx-colorist.js';
import audioMixer from './agents/audio-mixer.js';
import videoRenderer from './agents/video-renderer.js';


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
    // 阶段一：前期规划与理解
    console.log('📋 阶段一：前期规划与理解\n');
    
    // Agent 1: 音乐分析师
    const musicAnalysis = await musicAnalyst.analyze(audioPath, lyricsText);
    console.log(`   情感: ${musicAnalysis.analysis?.emotion?.primary || '未知'}`);
    console.log(`   主题: ${musicAnalysis.analysis?.theme?.mainTheme || '未知'}\n`);
    
    // Agent 2: 视觉概念生成器
    const visualConcept = await visualConceptGenerator.generate(musicAnalysis);
    console.log(`   风格: ${visualConcept.visualConcept?.style?.name || '未知'}\n`);
    
    // Agent 3: 脚本与分镜大师
    const storyboard = await storyboardMaster.generate(visualConcept);
    console.log(`   镜头数: ${storyboard.storyboard?.shots?.length || 0} 个\n`);
    
    // 阶段二：素材生成
    console.log('📋 阶段二：素材生成\n');
    
    // Agent 4: 关键帧生成器（生成 AB 关键帧）
    const keyframeData = await keyframeGenerator.generate(storyboard);
    console.log(`   关键帧: ${keyframeData.keyframes?.length || 0} 个镜头，共 ${(keyframeData.keyframes?.length || 0) * 2} 个关键帧\n`);
    
    // Agent 5: 视频生成器（基于 AB 关键帧生成视频）
    const materials = await videoGenerator.generate(keyframeData);
    console.log(`   视频素材: ${materials.materials?.length || 0} 个\n`);
    
    // 阶段三：后期制作与优化
    console.log('📋 阶段三：后期制作与优化\n');
    
    // Agent 6: 智能剪辑师
    const editOutputPath = path.join(config.paths.temp, 'edited_video.mp4');
    const editedVideo = await smartEditor.edit(materials.materials, audioPath, editOutputPath);
    
    // Agent 7: 视觉特效与调色师
    const fxOutputPath = path.join(config.paths.temp, 'fx_video.mp4');
    const fxVideo = await visualFXColorist.process(editOutputPath, visualConcept, fxOutputPath);
    
    // Agent 8: 音频混音与同步师
    const mixOutputPath = path.join(config.paths.temp, 'mixed_video.mp4');
    const mixedVideo = await audioMixer.mix(fxOutputPath, audioPath, mixOutputPath);
    
    // 阶段四：输出与迭代
    console.log('\n📋 阶段四：输出与迭代\n');
    
    // Agent 9: 视频渲染与优化器
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalOutputPath = path.join(config.paths.output, `music_video_${timestamp}.mp4`);
    const finalVideo = await videoRenderer.render(mixOutputPath, finalOutputPath);
    
    // 保存工作流结果（只保存每个 agent 的核心输出）
    const workflowResult = {
      // Agent 1: 音乐分析师
      musicAnalysis: {
        audioInfo: musicAnalysis.audioInfo,
        bpmInfo: musicAnalysis.bpmInfo,
        analysis: musicAnalysis.analysis,
        timestamp: musicAnalysis.timestamp,
        analysisMethod: musicAnalysis.analysisMethod,
      },
      // Agent 2: 视觉概念生成器
      visualConcept: visualConcept.visualConcept,
      // Agent 3: 脚本与分镜大师
      storyboard: storyboard.storyboard,
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
      // Agent 6: 智能剪辑师
      editedVideo: {
        outputPath: editedVideo.outputPath,
        timestamp: editedVideo.timestamp,
      },
      // Agent 7: 视觉特效与调色师
      fxVideo: {
        inputPath: fxVideo.inputPath,
        outputPath: fxVideo.outputPath,
        style: fxVideo.style,
        timestamp: fxVideo.timestamp,
      },
      // Agent 8: 音频混音与同步师
      mixedVideo: {
        videoPath: mixedVideo.videoPath,
        audioPath: mixedVideo.audioPath,
        outputPath: mixedVideo.outputPath,
        timestamp: mixedVideo.timestamp,
      },
      // Agent 9: 视频渲染与优化器
      finalVideo: {
        inputPath: finalVideo.inputPath,
        outputPath: finalVideo.outputPath,
        format: finalVideo.format,
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

