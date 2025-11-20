import fs from 'fs';
import path from 'path';
import config from '../../config/config.js';
import imageGenerator from '../../utils/image-generator.js';
import { batchConcurrent } from '../../utils/utils.js';
import characterLibrary from '../../utils/character-library.js';

const IMAGE_CONFIG = {
  width: 1920,   // 1080p 宽度
  height: 1080,  // 1080p 高度
  aspectRatio: '16:9',  // 1080p 宽高比
  style: 'cinematic',
  referenceImageName: '20251112-203804.jpg'
};

class KeyframeGeneratorAgent {
  constructor() {
    this.outputDir = path.join(config.paths.output, 'keyframes');
    this.referenceImagePath = path.join(config.paths.input, IMAGE_CONFIG.referenceImageName);
  }

  // 检查并初始化输出目录和角色库
  _initialize() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    const characters = characterLibrary.getAllCharacters();
    console.log(`🎭 角色库已加载: ${characters.length} 个角色`);
    characters.forEach((char, index) => {
      const imagePath = characterLibrary.getCharacterImagePath(char.name);
      const exists = imagePath && fs.existsSync(imagePath);
      console.log(`   ${index + 1}. ${char.name}${exists ? ' ✅' : ' ❌ (图片不存在)'}`);
    });
    console.log('');
  }

  // 为镜头选择角色
  _selectCharacterForShot(shot, storyboard) {
    // 如果 shot 中已经有角色信息，使用它
    if (shot.characterName) {
      const character = characterLibrary.getCharacterByName(shot.characterName);
      if (character) {
        return character;
      }
      console.warn(`⚠️  镜头 ${shot.shotNumber} 指定的角色 "${shot.characterName}" 不存在，将自动选择`);
    }
    
    // 根据场景描述智能选择角色
    const sceneDescription = shot.keyframePrompt || shot.action || '';
    return characterLibrary.selectCharacterForScene(sceneDescription, shot.shotNumber);
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

  // 基于分镜脚本生成关键帧（每个镜头一张）
  async generate(storyboard) {
    console.log('🎨 Agent 4: 关键帧生成器 - 开始生成...');
    
    try {
      this._initialize();
      
      const shots = storyboard.storyboard.shots || [];
      console.log(`📸 为 ${shots.length} 个镜头生成关键帧...\n`);
      
      // 准备所有任务数据
      const tasks = shots.map((shot, i) => ({
        shot,
        storyboard,
        context: {
          previousShot: i > 0 ? shots[i - 1] : null,
          nextShot: i < shots.length - 1 ? shots[i + 1] : null
        },
        keyframeData: null
      }));
      
      // 使用并发控制工具函数，每批5个
      await batchConcurrent(tasks,
        async (task) => {
          console.log(`  📸 镜头 ${task.shot.shotNumber}/${shots.length}: ${task.shot.timeRange}秒`);
          const keyframe = await this.generateKeyframe(task.shot, task.storyboard, task.context);
          task.keyframeData = this._createKeyframeData(task.shot, keyframe, task.context.nextShot);
        },
        {
          concurrency: 5,
          startIndex: 0,
          onBatchStart: (batch, batchNum, total) => {
            console.log(`\n📦 批次 ${batchNum}/${total}: 镜头 ${batch[0].shot.shotNumber}-${batch[batch.length - 1].shot.shotNumber}`);
          },
          onBatchComplete: (batch, batchNum) => {
            console.log(`  ✅ 批次 ${batchNum} 完成\n`);
          }
        }
      );
      
      const keyframes = tasks.map(task => task.keyframeData);

      console.log(`✅ 关键帧生成完成: ${keyframes.length} 个镜头\n`);
      
      return {
        storyboard,
        keyframes,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ 关键帧生成失败:', error);
      throw error;
    }
  }

  // 生成单个关键帧
  async generateKeyframe(shot, storyboard, context) {
    try {
      const prompt = this._buildPrompt(shot, storyboard, context);
      const keyframePath = path.join(this.outputDir, `shot_${shot.shotNumber}.png`);
      
      await this._renderImage(prompt, keyframePath, shot, storyboard, context.nextShot);
      
      return {
        path: keyframePath,
        url: `./keyframes/shot_${shot.shotNumber}.png`,
        absolutePath: keyframePath,
        shotNumber: shot.shotNumber,
        prompt,
        nextShotNumber: context.nextShot?.shotNumber || null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`  ❌ 镜头 ${shot.shotNumber} 生成失败:`, error.message);
      throw error;
    }
  }

  // 构建关键帧提示词（生成起始帧）
  _buildPrompt(shot, storyboard, { previousShot, nextShot }) {
    // 必须使用 keyframePrompt，如果没有则抛出错误
    if (!shot.keyframePrompt) {
      throw new Error(`镜头 ${shot.shotNumber} 缺少必需的 keyframePrompt 字段`);
    }
    
    // 选择角色
    const character = this._selectCharacterForShot(shot, storyboard);
    console.log(`    🎭 使用角色: ${character.name}`);
    
    const concept = storyboard?.visualConcept?.visualConcept;
    const style = concept?.style?.name || '';
    const colors = concept?.colorPalette?.primary?.join(', ') || '';
    
    // 在提供的提示词基础上添加必要的补充信息
    // 将角色一致性要求放在最前面，确保最高优先级
    const characterConsistencyRules = [
      `CRITICAL: REFERENCE IMAGE IS THE AUTHORITATIVE SOURCE`,
      `You are provided with a reference image showing the EXACT character design you must use.`,
      `The reference image shows "${character.name}" with the following description: ${character.desc}`,
      `ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:`,
      `1. The character in the reference image has NO HAIR - DO NOT add hair under any circumstances`,
      `2. The character's appearance in the reference image is FINAL - DO NOT modify, add, or remove ANY features`,
      `3. If the reference image shows a backpack, the character MUST have a backpack`,
      `4. If the reference image shows NO hair, the character MUST have NO hair`,
      `5. Every detail in the reference image must be replicated EXACTLY`,
      `ABSOLUTELY FORBIDDEN - DO NOT:`,
      `- DO NOT add hair, even if the scene description mentions hair`,
      `- DO NOT add accessories, clothing, or items not visible in the reference image`,
      `- DO NOT remove backpacks, accessories, or any items shown in the reference image`,
      `- DO NOT change colors, proportions, design elements, or visual details`,
      `- DO NOT modify facial features, body shape, or any appearance aspects`,
      `- DO NOT interpret or "improve" the character design - use it EXACTLY as shown`,
      `MANDATORY:`,
      `- Copy the character from the reference image pixel-perfectly`,
      `- Every single detail must match the reference image exactly`,
      `- The reference image is the ONLY source of truth for character appearance`,
      `- Ignore any conflicting descriptions in the scene prompt - the reference image takes precedence`
    ];
    
    const parts = [
      // 最高优先级：角色一致性要求（放在最前面）
      ...characterConsistencyRules,
      // 场景描述（在角色要求之后）
      shot.keyframePrompt,
      'This is a STATIC keyframe image showing the INITIAL STATE before any action begins',
      'cinematic, high quality, detailed, still frame, start keyframe, initial moment',
      'Maintain consistent character scale and scene composition across all shots'
    ];
    
    if (style) parts.push(`${style} style`);
    if (colors) parts.push(`${colors} color palette`);
    
    if (previousShot) {
      parts.push(`visually connected to previous shot (shot ${previousShot.shotNumber}), smooth transition from previous scene`);
      parts.push(`Maintain consistent character size and scene scale with previous shot (shot ${previousShot.shotNumber})`);
    }
    
    // 场景大小一致性要求
    parts.push(`Maintain consistent scene scale and character proportions across all shots`);
    parts.push(`Keep the same character size relative to the scene - do not change character scale between shots`);

    return parts.join(', ');
  }

  // 渲染关键帧图像
  async _renderImage(prompt, outputPath, shot, storyboard, nextShot) {
    const options = { 
      ...IMAGE_CONFIG,
    };
    
    // 使用角色库中的角色图片作为参考图片
    const character = this._selectCharacterForShot(shot, storyboard);
    const characterImagePath = characterLibrary.getCharacterImagePath(character.name);
    
    if (characterImagePath && fs.existsSync(characterImagePath)) {
      options.referenceImage = characterImagePath;
      console.log(`    🎭 使用角色参考图片: ${character.name} (${path.basename(characterImagePath)})`);
    } else {
      console.warn(`    ⚠️  角色 "${character.name}" 的图片不存在: ${characterImagePath}`);
    }
    
    await imageGenerator.generateImage(prompt, outputPath, options);
    console.log(`    ✅ 关键帧生成完成 (1080p, 1920x1080)`);
    return outputPath;
  }
}

export default new KeyframeGeneratorAgent();

