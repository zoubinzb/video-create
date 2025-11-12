# 使用示例

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 Gemini API Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 准备素材

- 准备一首 MP3 格式的音乐文件（建议30秒左右，或更长）
- （可选）准备歌词文本文件（.txt 格式）

### 4. 准备输入文件

将你的音乐文件放入 `input` 文件夹：
- 支持的音频格式：`.mp3`, `.wav`, `.m4a`, `.flac`, `.aac`, `.ogg`
- （可选）歌词文件：`.txt` 或 `.lrc` 格式
  - 可以与音频文件同名（如：`song.mp3` 和 `song.txt`）
  - 或命名为 `lyrics.txt`

### 5. 运行程序

```bash
node index.js
```

程序会自动：
- 从 `input` 文件夹查找音频文件
- 自动匹配歌词文件（如果存在）
- 将结果输出到 `output` 文件夹

## 输出说明

程序会在以下目录生成文件：

- `output/` - 最终视频和工作流结果
- `temp/` - 临时文件（中间处理步骤）

## 工作流程说明

系统会按照以下步骤自动处理：

1. **音乐分析** - 分析歌曲的情感、节奏、主题
2. **视觉概念** - 生成视觉风格和场景描述
3. **分镜脚本** - 创建详细的分镜脚本
4. **素材生成** - 生成图像素材（当前为占位符）
5. **视频剪辑** - 自动剪辑和合成
6. **视觉处理** - 应用调色和特效
7. **音频混音** - 同步音频和视频
8. **最终渲染** - 输出高质量视频

## 注意事项

1. **FFmpeg 要求**：确保系统已安装 FFmpeg 并添加到 PATH
   - Windows: 下载 FFmpeg 并添加到系统 PATH
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

2. **API 限制**：Gemini API 有调用频率限制，请合理使用

3. **图像生成**：当前版本使用占位符图像，实际应用需要集成图像生成 API（如 Stable Diffusion）

4. **处理时间**：完整流程可能需要几分钟到十几分钟，取决于视频长度和复杂度

## 扩展功能

### 集成真实的图像生成 API

编辑 `agents/image-video-generator.js`，在 `generatePlaceholderImages` 方法中替换为真实的 API 调用：

```javascript
// 示例：使用 Stable Diffusion API
const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.STABLE_DIFFUSION_API_KEY}`,
  },
  body: JSON.stringify({
    text_prompts: [{ text: prompt }],
    cfg_scale: 7,
    height: 1024,
    width: 1024,
  }),
});
```

### 自定义视频参数

编辑 `config/config.js` 修改视频参数：

```javascript
video: {
  duration: 30,  // 视频时长（秒）
  fps: 30,       // 帧率
  width: 1920,   // 宽度
  height: 1080,  // 高度
}
```

## 故障排除

### FFmpeg 未找到

确保 FFmpeg 已正确安装：
```bash
ffmpeg -version
```

### API Key 错误

检查 `.env` 文件中的 API Key 是否正确

### 内存不足

如果处理大文件时出现内存错误，可以：
- 降低视频分辨率
- 减少图像数量
- 增加系统内存

