import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import characterLibrary from '../character-library/desc.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 角色库管理器
 */
class CharacterLibrary {
  constructor() {
    this.characters = characterLibrary;
    this.baseDir = path.join(__dirname, '..', 'character-library');
    this._validateCharacters();
  }

  /**
   * 验证角色库数据
   */
  _validateCharacters() {
    for (const character of this.characters) {
      const imagePath = this.getCharacterImagePath(character.name);
      if (!fs.existsSync(imagePath)) {
        console.warn(`⚠️  角色 "${character.name}" 的图片不存在: ${imagePath}`);
      }
    }
  }

  /**
   * 获取所有角色列表
   */
  getAllCharacters() {
    return this.characters;
  }

  /**
   * 根据名称获取角色信息
   */
  getCharacterByName(name) {
    return this.characters.find(char => char.name === name);
  }

  /**
   * 根据索引获取角色信息
   */
  getCharacterByIndex(index) {
    return this.characters[index] || null;
  }

  /**
   * 获取角色的完整图片路径
   */
  getCharacterImagePath(characterName) {
    const character = this.getCharacterByName(characterName);
    if (!character) {
      return null;
    }
    // 将相对路径转换为绝对路径
    const relativePath = character.image.replace('./', '');
    return path.join(this.baseDir, relativePath);
  }

  /**
   * 根据场景描述智能选择角色
   * 可以根据关键词匹配选择合适的角色
   */
  selectCharacterForScene(sceneDescription, shotNumber = null) {
    if (!sceneDescription) {
      // 如果没有场景描述，使用轮询方式选择角色
      const index = shotNumber ? (shotNumber - 1) % this.characters.length : 0;
      return this.characters[index];
    }

    const descLower = sceneDescription.toLowerCase();
    
    // 关键词匹配规则
    const keywordRules = [
      { keywords: ['粉色', '粉', 'pink'], characterIndex: 0 }, // 桃桃熊
      { keywords: ['蓝色', '蓝', 'blue'], characterIndex: 1 }, // 蓝蓝熊
      { keywords: ['猴子', '猴', 'monkey', '橙色', 'orange'], characterIndex: 2 }, // 猴扮熊宝
      { keywords: ['老虎', '虎', 'tiger', '彩虹', 'rainbow'], characterIndex: 3 }, // 彩鬃小虎
      { keywords: ['海', 'sea', 'ocean', '蓝白'], characterIndex: 4 }, // 海蓝熊
      { keywords: ['兔子', '兔', 'rabbit', '黄色', 'yellow'], characterIndex: 5 }, // 蓝兔小黄
      { keywords: ['青蛙', 'frog', '绿色', 'green'], characterIndex: 6 }, // 蛙趣兄弟
    ];

    // 尝试匹配关键词
    for (const rule of keywordRules) {
      if (rule.keywords.some(keyword => descLower.includes(keyword))) {
        return this.characters[rule.characterIndex];
      }
    }

    // 如果没有匹配，使用轮询方式
    const index = shotNumber ? (shotNumber - 1) % this.characters.length : 0;
    return this.characters[index];
  }

  /**
   * 获取角色的提示词描述
   */
  getCharacterPrompt(characterName) {
    const character = this.getCharacterByName(characterName);
    if (!character) {
      return '';
    }
    return `Character: ${character.name} (${character.desc})`;
  }
}

export default new CharacterLibrary();

