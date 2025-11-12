# 🎵 AI Agents 全流程音乐视频制作系统

使用 Node.js 和 Google Gemini API 实现的自动化音乐视频制作系统。

## 功能特性

- 🎶 自动分析音乐情感、节奏和主题
- 🎨 智能生成视觉概念和风格
- 📝 自动创建分镜脚本
- 🖼️ 生成图像和视频素材
- ✂️ 智能剪辑和音画同步
- 🎬 自动渲染最终视频

## 安装

```bash
npm install
```

## 配置

1. 复制 `.env.example` 为 `.env`
2. 填入你的 Gemini API Key

```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的 API Key：
```
GEMINI_API_KEY=your_api_key_here
```

3. 检查环境配置

```bash
npm run test-setup
```

这将检查：
- 环境变量配置
- FFmpeg 安装状态
- 目录结构
- Node.js 版本

## 使用方法

1. 将音乐文件放入 `input` 文件夹
2. （可选）将歌词文件放入 `input` 文件夹（支持同名或 `lyrics.txt`）
3. 运行程序：

```bash
# 首次运行或重新开始
node index.js

# 从检查点继续执行（如果上次执行失败）
node index.js --resume
# 或使用简写
node index.js -r

# 清除检查点并重新开始
node index.js --clear
# 或使用简写
node index.js -c
```

程序会自动：
- 从 `input` 文件夹查找音频文件（支持 .mp3, .wav, .m4a, .flac, .aac, .ogg）
- 自动匹配歌词文件（同名或 `lyrics.txt`）
- 将结果输出到 `output` 文件夹
- **自动保存每个步骤的检查点，支持断点续传**

## 系统要求

- Node.js 18+
- FFmpeg（推荐安装，用于视频处理。如果未安装，程序会使用默认值继续运行，但视频剪辑功能将不可用）

> 📖 **FFmpeg 安装指南**：请查看 [FFMPEG_INSTALL.md](./FFMPEG_INSTALL.md)
- Gemini API Key

## 项目结构

```
├── agents/           # AI Agents 模块
├── utils/            # 工具函数
├── config/           # 配置文件
├── output/           # 输出目录
├── temp/             # 临时文件目录
└── index.js          # 主入口文件
```

## 工作流程

1. **音乐分析** - 分析歌曲情感、节奏、主题
2. **视觉概念生成** - 生成视觉风格和场景描述
3. **分镜脚本** - 创建详细的分镜脚本
4. **素材生成** - 使用 veo-3.1-generate-preview 生成视频素材
5. **剪辑合成** - 自动剪辑和音画同步
6. **后期处理** - 调色、特效、音频处理
7. **渲染输出** - 生成最终视频

## 断点续传功能

系统支持断点续传，每个步骤完成后会自动保存检查点：

- **自动保存**：每个 Agent 执行完成后自动保存结果
- **断点续传**：如果某个步骤失败，使用 `--resume` 参数从失败的地方继续
- **中间结果**：每个步骤的详细结果保存在 `output/` 目录
- **检查点文件**：保存在 `temp/checkpoints/workflow_checkpoint.json`

### 使用场景

```bash
# 场景1: 首次运行
node index.js

# 场景2: 运行到一半失败，修复问题后继续
node index.js --resume

# 场景3: 想重新开始（清除所有检查点）
node index.js --clear
```

## 注意事项

- 这是一个演示版本，某些功能可能需要额外的 API 服务
- 视频生成质量取决于使用的 AI 模型
- 处理时间取决于视频长度和复杂度

