# FFmpeg 安装指南

FFmpeg 是视频和音频处理的核心工具。本系统需要 FFmpeg 来完成视频剪辑、音频处理等功能。

## Windows 安装方法

### 方法 1: 使用 Chocolatey（推荐）

如果你已安装 Chocolatey：

```bash
choco install ffmpeg
```

### 方法 2: 手动安装

1. **下载 FFmpeg**
   - 访问：https://www.gyan.dev/ffmpeg/builds/
   - 下载 `ffmpeg-release-essentials.zip`

2. **解压文件**
   - 解压到任意目录，例如：`C:\ffmpeg`

3. **添加到系统 PATH**
   - 右键点击"此电脑" → "属性"
   - 点击"高级系统设置"
   - 点击"环境变量"
   - 在"系统变量"中找到 `Path`，点击"编辑"
   - 点击"新建"，添加 FFmpeg 的 `bin` 目录路径，例如：`C:\ffmpeg\bin`
   - 点击"确定"保存

4. **验证安装**
   - 打开新的命令提示符（CMD）或 PowerShell
   - 运行：`ffmpeg -version`
   - 如果显示版本信息，说明安装成功

### 方法 3: 使用 Scoop

如果你已安装 Scoop：

```bash
scoop install ffmpeg
```

## macOS 安装方法

### 使用 Homebrew（推荐）

```bash
brew install ffmpeg
```

### 验证安装

```bash
ffmpeg -version
```

## Linux 安装方法

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install ffmpeg
```

### CentOS/RHEL

```bash
sudo yum install ffmpeg
```

### 验证安装

```bash
ffmpeg -version
```

## 注意事项

1. **重启终端**：安装 FFmpeg 后，需要关闭并重新打开终端，PATH 更改才会生效。

2. **检查 PATH**：如果安装后仍然提示找不到命令，请检查 PATH 环境变量是否正确设置。

3. **版本要求**：建议使用 FFmpeg 4.0 或更高版本。

## 临时解决方案

如果暂时无法安装 FFmpeg，程序会使用默认值继续运行，但以下功能将不可用：
- 精确的音频时长检测
- 视频剪辑和合成
- 音频格式转换

**建议尽快安装 FFmpeg 以获得完整功能。**

## 故障排除

### 问题：命令提示符中找不到 ffmpeg

**解决方案**：
1. 确认 FFmpeg 已正确安装
2. 检查 PATH 环境变量是否包含 FFmpeg 的 bin 目录
3. 重启终端或命令提示符
4. 在 Windows 上，可能需要重启计算机

### 问题：权限错误

**解决方案**：
- Linux/macOS: 使用 `sudo` 安装
- Windows: 以管理员身份运行安装程序

### 问题：版本不兼容

**解决方案**：
- 更新到最新版本的 FFmpeg
- 检查系统架构（32位/64位）是否匹配

## 测试安装

运行以下命令测试 FFmpeg 是否正常工作：

```bash
ffmpeg -version
ffprobe -version
```

如果两个命令都能显示版本信息，说明安装成功！

