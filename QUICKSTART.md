# 快速开始指南

## 5 分钟快速上手

### 步骤 1: 安装依赖

```bash
npm install
```

### 步骤 2: 获取 Gemini API Key

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建新的 API Key
3. 复制 API Key

### 步骤 3: 配置环境变量

创建 `.env` 文件（复制 `.env.example`）：

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 API Key：

```
GEMINI_API_KEY=你的API密钥
```

### 步骤 4: 检查环境

```bash
npm run test-setup
```

确保所有检查项都通过 ✅

### 步骤 5: 准备测试文件

1. 创建 `input` 文件夹（如果不存在，程序会自动创建）
2. 将音乐文件放入 `input` 文件夹（支持 .mp3, .wav, .m4a 等格式）
3. （可选）将歌词文件放入 `input` 文件夹：
   - 与音频文件同名（如：`song.mp3` 和 `song.txt`）
   - 或命名为 `lyrics.txt`

### 步骤 6: 运行程序

```bash
node index.js
```

程序会自动从 `input` 文件夹读取文件并处理！

### 步骤 7: 查看结果

处理完成后，在 `output/` 目录找到生成的视频文件！

## 常见问题

### Q: FFmpeg 未找到？

**Windows:**
1. 下载 FFmpeg: https://ffmpeg.org/download.html
2. 解压到某个目录（如 `C:\ffmpeg`）
3. 添加到系统 PATH 环境变量

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### Q: API Key 错误？

- 检查 `.env` 文件中的 API Key 是否正确
- 确保没有多余的空格
- 确认 API Key 有效且有足够的配额

### Q: 生成的视频质量不高？

当前版本使用占位符图像。要生成真实图像：
1. 集成图像生成 API（如 Stable Diffusion）
2. 修改 `agents/image-video-generator.js`
3. 参考 `example-usage.md` 中的扩展功能部分

### Q: 处理时间很长？

这是正常的，因为涉及：
- 多次 AI API 调用
- 视频编码处理
- 文件 I/O 操作

通常需要 5-15 分钟，取决于视频长度和复杂度。

## 下一步

- 阅读 `README.md` 了解完整功能
- 查看 `example-usage.md` 了解高级用法
- 查看 `PROJECT_STRUCTURE.md` 了解项目结构
- 集成真实的图像生成 API 提升质量

## 需要帮助？

- 检查控制台输出的错误信息
- 查看 `output/workflow_result_*.json` 了解详细处理过程
- 确保所有依赖已正确安装

