import fs from 'fs';
import path from 'path';
import config from '../config/config.js';
import geminiClient from '../utils/gemini-client.js';
import { batchConcurrent } from '../utils/utils.js';

const IMAGE_CONFIG = {
  width: 1920,
  height: 1080,
  style: 'cinematic',
  referenceImageName: '20251112-203804.jpg'
};

/**
 * 关键帧生成器 V2
 * 方案：先生成一张完整的 storyboard 大图，然后逐个提取关键帧
 */
class KeyframeGeneratorAgentV2 {
  constructor() {
    this.outputDir = path.join(config.paths.output, 'keyframes');
    this.referenceImagePath = path.join(config.paths.input, IMAGE_CONFIG.referenceImageName);
    this.storyboardImagePath = path.join(this.outputDir, 'storyboard_all.png');
  }

  // 检查并初始化输出目录
  _initialize() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const hasReference = fs.existsSync(this.referenceImagePath);
    if (hasReference) {
      console.log(`📸 使用参考图片: ${path.basename(this.referenceImagePath)}\n`);
    } else {
      console.warn(`⚠️  参考图片不存在，将不使用参考图片\n`);
    }
    
    return hasReference;
  }

  // 生成关键帧数据结构
  _createKeyframeData(shot, keyframe, nextShot) {
    return {
      shotNumber: shot.shotNumber,
      timeRange: shot.timeRange,
      startTime: shot.startTime,
      endTime: shot.endTime,
      keyframeA: keyframe,
      keyframeB: keyframe,
      shot,
      nextShot
    };
  }

  // 构建完整 storyboard 的提示词
  _buildStoryboardPrompt(shots, storyboard) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    
    // 添加每个镜头的详细描述
    const shotDescriptions = shots.map((shot, index) => {
      const details = [
        `Panel ${index + 1}:`,
        `Scene: ${shot.action || shot.composition}`,
        `Framing: ${shot.framing}`,
        `Details: ${shot.prompt || shot.composition}`
      ].join(' ');
      return `\n  ${details}`;
    }).join('');
    
    const parts = [
      `Create a professional storyboard layout with exactly ${shots.length} distinct scene panels for AI video production (YouTube Kids).`,
      ``,
      `CRITICAL: The reference image shows the VISUAL STYLE ONLY - use it as a style guide, NOT as content for every panel.`,
      `Each panel must show a DIFFERENT scene based on its description below.`,
      ``,
      `LAYOUT REQUIREMENTS:`,
      `- Arrange ${shots.length} separate panels in a clear ${this._getGridLayout(shots.length)} grid layout`,
      `- Each panel clearly separated with visible borders and numbered (1-${shots.length})`,
      `- Equal-sized panels with consistent spacing`,
      `- Each panel shows a UNIQUE scene - different characters, actions, and settings`,
      ``,
      `VISUAL STYLE (consistent across all panels):`,
      `- Soft 3D cartoon style, pastel colors, very kid-friendly`,
      `- Bright, soft, colorful, and friendly atmosphere`,
      `- Warm lighting throughout`,
      `- NO text labels, only panel numbers in corners`,
      ``,
      `IMPORTANT: Each panel must accurately depict its specific scene description.`,
      `Do NOT repeat the same character or scene in multiple panels.`,
      `Create diverse, distinct visuals for each panel based on the descriptions below.`,
      ``,
      `PANEL SCENE DESCRIPTIONS:${shotDescriptions}`,
      ``
    ];
    
    if (style) parts.push(`Overall visual style: ${style}`);
    parts.push('Each panel is a unique scene that will be extracted individually. Make them visually distinct and recognizable.');
    
    return parts.join(' ');
  }

  // 获取网格布局建议
  _getGridLayout(count) {
    if (count <= 2) return '1x2 or 2x1';
    if (count <= 4) return '2x2';
    if (count <= 6) return '2x3 or 3x2';
    if (count <= 9) return '3x3';
    if (count <= 12) return '3x4 or 4x3';
    return `grid (${Math.ceil(Math.sqrt(count))} columns)`;
  }

  // 构建单个关键帧提取的提示词
  _buildExtractPrompt(shot, shotIndex, totalShots, storyboard) {
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const gridLayout = this._getGridLayout(totalShots);
    const position = this._getGridPosition(shotIndex, totalShots);
    
    const parts = [
      `CRITICAL TASK: Extract and recreate ONLY Panel ${shotIndex + 1} from the reference storyboard image.`,
      ``,
      `STORYBOARD INFORMATION:`,
      `- The reference image contains ${totalShots} panels in a ${gridLayout} grid layout`,
      `- Each panel is numbered (look for number ${shotIndex + 1})`,
      `- You need to extract Panel ${shotIndex + 1}, which is located at: ${position}`,
      `- DO NOT mix content from other panels`,
      ``,
      `EXTRACTION METHOD:`,
      `1. Locate Panel ${shotIndex + 1} (numbered ${shotIndex + 1}) in the reference storyboard`,
      `2. Identify the EXACT scene content from that specific panel only`,
      `3. Recreate that panel's content as a full-resolution single image`,
      `4. Maintain the EXACT character design, pose, and scene composition from that panel`,
      ``,
      `SCENE CONTENT FOR PANEL ${shotIndex + 1}:`,
      `- Composition: ${shot.composition}`,
      `- Framing: ${shot.framing}`,
      `- Lighting: ${shot.lighting}`,
      `- Action: ${shot.action || 'establishing shot'}`,
      ``,
      `IMPORTANT NOTES:`,
      `- This is the opening moment (entrance frame) of this specific scene`,
      `- Extract ONLY this panel's content - do not include elements from adjacent panels`,
      `- The character must match EXACTLY as shown in Panel ${shotIndex + 1} of the storyboard`,
      `- Enhance the resolution and detail, but keep the same visual composition`
    ];
    
    if (style) parts.push(`\nVisual style: ${style}`);
    if (shot.syncPoint) parts.push(`Music sync: ${shot.syncPoint}`);
    
    parts.push('');
    parts.push('OUTPUT REQUIREMENTS:');
    parts.push('- Single, clear keyframe image (1920x1080)');
    parts.push('- Soft 3D cartoon style, pastel colors, kid-friendly');
    parts.push('- Bright, soft, colorful, and friendly atmosphere');
    parts.push('- Warm lighting, no text or labels');
    parts.push('- Maintain exact visual consistency with the source panel');
    
    return parts.join(' ');
  }

  // 获取网格位置描述
  _getGridPosition(index, total) {
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols) + 1;
    const col = (index % cols) + 1;
    
    const rowDesc = row === 1 ? 'top row' : row === Math.ceil(total / cols) ? 'bottom row' : `row ${row}`;
    const colDesc = col === 1 ? 'leftmost' : col === cols ? 'rightmost' : `column ${col}`;
    
    return `${rowDesc}, ${colDesc}`;
  }

  // 获取序数词后缀
  _getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }

  // 步骤1：生成完整的 storyboard 大图
  async _generateStoryboard(shots, storyboard) {
    console.log('📸 步骤 1/2: 生成完整 storyboard 大图...\n');
    
    const prompt = this._buildStoryboardPrompt(shots, storyboard);
    console.log(`  提示词: ${prompt.substring(0, 150)}...`);
    
    const options = {
      ...IMAGE_CONFIG,
      width: 1920, // 更大的画布以容纳多个关键帧
      height: 1920
    };
    
    // 策略调整：生成 storyboard 时不使用参考图片
    // 这样可以让每个 panel 根据场景描述自由生成，不受参考图片内容限制
    // 参考图片只在后续提取关键帧时用于保持风格一致性
    console.log(`  📝 基于场景描述生成 storyboard（不使用参考图片，避免内容重复）`);
    
    try {
      await geminiClient.generateImage(prompt, this.storyboardImagePath, options);
      console.log(`  ✅ Storyboard 大图生成完成\n`);
      return this.storyboardImagePath;
    } catch (error) {
      console.error(`  ❌ Storyboard 大图生成失败:`, error.message);
      throw error;
    }
  }

  // 步骤2：从 storyboard 提取单个关键帧
  async _extractKeyframe(shot, shotIndex, totalShots, storyboard) {
    const position = this._getGridPosition(shotIndex, totalShots);
    console.log(`  📸 镜头 ${shot.shotNumber}/${totalShots}: Panel ${shotIndex + 1} (${position})`);
    
    const prompt = this._buildExtractPrompt(shot, shotIndex, totalShots, storyboard);
    const keyframePath = path.join(this.outputDir, `shot_${shot.shotNumber}.png`);
    
    const options = {
      ...IMAGE_CONFIG,
      referenceImage: this.storyboardImagePath // 使用 storyboard 大图作为参考
    };
    
    try {
      await geminiClient.generateImage(prompt, keyframePath, options);
      console.log(`    ✅ 提取完成: Panel ${shotIndex + 1} → shot_${shot.shotNumber}.png`);
      
      return {
        path: keyframePath,
        url: `./keyframes/shot_${shot.shotNumber}.png`,
        absolutePath: keyframePath,
        shotNumber: shot.shotNumber,
        prompt,
        panelNumber: shotIndex + 1,
        gridPosition: position,
        nextShotNumber: null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`    ❌ Panel ${shotIndex + 1} 提取失败:`, error.message);
      throw error;
    }
  }

  // 主生成方法
  async generate(storyboard) {
    console.log('🎨 Agent 4 (V2): 关键帧生成器 - 方案二\n');
    console.log('   方案说明: 先生成完整 storyboard，再逐个提取关键帧\n');
    
    try {
      this._initialize();
      
      const shots = storyboard.storyboard.shots || [];
      console.log(`📸 为 ${shots.length} 个镜头生成关键帧...\n`);
      
      // 步骤1：生成完整的 storyboard 大图
      await this._generateStoryboard(shots, storyboard);
      
      // 步骤2：逐个提取关键帧
      console.log('📸 步骤 2/2: 从 storyboard 提取关键帧...\n');
      
      const tasks = shots.map((shot, i) => ({
        shot,
        storyboard,
        shotIndex: i,
        totalShots: shots.length,
        keyframeData: null,
        context: {
          previousShot: i > 0 ? shots[i - 1] : null,
          nextShot: i < shots.length - 1 ? shots[i + 1] : null
        }
      }));
      
      // 使用并发控制，降低并发数以避免 API 速率限制
      await batchConcurrent(tasks,
        async (task) => {
          const keyframe = await this._extractKeyframe(
            task.shot,
            task.shotIndex,
            task.totalShots,
            task.storyboard
          );
          task.keyframeData = this._createKeyframeData(
            task.shot,
            keyframe,
            task.context.nextShot
          );
        },
        {
          concurrency: 1, // 降低并发数，避免 API 速率限制
          onBatchStart: (batch, batchNum, total) => {
            console.log(`\n📦 批次 ${batchNum}/${total}: 镜头 ${batch[0].shot.shotNumber}-${batch[batch.length - 1].shot.shotNumber}`);
          },
          onBatchComplete: async (batch, batchNum, total) => {
            console.log(`  ✅ 批次 ${batchNum} 完成`);
            // 批次间添加延迟，避免速率限制
            if (batchNum < total) {
              const delay = 2000; // 2秒延迟
              console.log(`  ⏳ 等待 ${delay}ms 后继续下一批次...\n`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      );
      
      const keyframes = tasks.map(task => task.keyframeData);

      console.log(`✅ 关键帧生成完成: ${keyframes.length} 个镜头\n`);
      
      return {
        storyboard,
        keyframes,
        storyboardImage: this.storyboardImagePath,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 关键帧生成失败:', error);
      throw error;
    }
  }
}

export default new KeyframeGeneratorAgentV2();

