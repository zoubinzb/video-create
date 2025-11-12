# 项目结构说明

```
ai-music-video-creator/
├── agents/                      # AI Agents 模块
│   ├── music-analyst.js        # Agent 1: 音乐分析师
│   ├── visual-concept-generator.js  # Agent 2: 视觉概念生成器
│   ├── storyboard-master.js    # Agent 3: 脚本与分镜大师
│   ├── image-video-generator.js # Agent 4: 图像/视频生成器
│   ├── smart-editor.js         # Agent 5: 智能剪辑师
│   ├── visual-fx-colorist.js   # Agent 6: 视觉特效与调色师
│   ├── audio-mixer.js          # Agent 7: 音频混音与同步师
│   └── video-renderer.js       # Agent 8: 视频渲染与优化器
│
├── utils/                       # 工具函数
│   ├── gemini-client.js        # Gemini API 客户端
│   └── audio-utils.js          # 音频处理工具
│
├── config/                      # 配置文件
│   └── config.js               # 主配置文件
│
├── output/                      # 输出目录（自动创建）
│   └── *.mp4                   # 最终视频文件
│   └── workflow_result_*.json  # 工作流结果
│
├── temp/                        # 临时文件目录（自动创建）
│   └── shot_*.png              # 生成的图像素材
│   └── edited_video.mp4        # 中间处理文件
│
├── index.js                     # 主入口文件
├── test-setup.js               # 环境检查脚本
├── package.json                 # 项目配置
├── .env.example                 # 环境变量示例
├── .gitignore                   # Git 忽略文件
├── README.md                    # 项目说明
├── example-usage.md            # 使用示例
└── PROJECT_STRUCTURE.md        # 本文件
```

## 核心模块说明

### Agents（AI 代理）

每个 Agent 负责特定的任务，按照工作流程顺序执行：

1. **music-analyst.js** - 分析音乐文件，提取情感、节奏、主题等信息
2. **visual-concept-generator.js** - 基于音乐分析生成视觉概念和风格
3. **storyboard-master.js** - 创建详细的分镜脚本
4. **image-video-generator.js** - 生成图像和视频素材（当前为占位符）
5. **smart-editor.js** - 自动剪辑和合成视频
6. **visual-fx-colorist.js** - 应用视觉特效和调色
7. **audio-mixer.js** - 音频混音和同步
8. **video-renderer.js** - 最终视频渲染和优化

### Utils（工具函数）

- **gemini-client.js** - 封装 Gemini API 调用，提供文本生成和 JSON 生成功能
- **audio-utils.js** - 音频文件处理工具，包括信息提取、格式转换等

### Config（配置）

- **config.js** - 统一管理配置，包括 API Key、路径、视频参数等

## 数据流

```
输入（音乐文件 + 可选歌词）
    ↓
[音乐分析] → 音乐分析报告
    ↓
[视觉概念] → 视觉风格和场景描述
    ↓
[分镜脚本] → 详细分镜脚本
    ↓
[素材生成] → 图像/视频素材
    ↓
[智能剪辑] → 初剪视频
    ↓
[视觉处理] → 调色和特效后的视频
    ↓
[音频混音] → 音画同步的视频
    ↓
[视频渲染] → 最终视频文件
```

## 扩展点

### 集成真实图像生成 API

修改 `agents/image-video-generator.js` 中的 `generatePlaceholderImages` 方法，替换为真实的 API 调用。

### 添加新的视觉风格

修改 `agents/visual-fx-colorist.js` 中的 `buildFilters` 方法，添加新的风格滤镜。

### 自定义视频参数

修改 `config/config.js` 中的视频配置参数。

### 添加新的 Agent

1. 在 `agents/` 目录创建新的 Agent 文件
2. 在 `index.js` 中导入并调用
3. 按照工作流程顺序插入到适当位置

