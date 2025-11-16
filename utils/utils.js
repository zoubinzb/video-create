import fs from 'fs';
import path from 'path';
/**
 * 从 input 文件夹查找音频文件
 */
export function findAudioFile(inputDir) {
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
export  function findLyricsFile(inputDir, audioFileName = null) {
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
 * 批量并发执行任务，支持并发数量控制和起始位置选择
 * @param {Array} items - 需要处理的数据项数组
 * @param {Function} asyncFn - 异步处理函数，接收单个 item 作为参数
 * @param {Object} options - 配置选项
 * @param {number} options.concurrency - 并发数量，默认为 1
 * @param {number} options.startIndex - 起始索引位置，默认为 0
 * @param {Function} options.onBatchStart - 批次开始回调
 * @param {Function} options.onBatchComplete - 批次完成回调
 * @returns {Promise<Array>} 返回处理后的结果数组
 */
export async function batchConcurrent(items, asyncFn, options = {}) {
  const {
    concurrency = 1,
    startIndex = 0,
    onBatchStart = null,
    onBatchComplete = null
  } = options;
  
  const total = items.length;
  const actualStart = Math.max(0, Math.min(startIndex, total));
  const remainingItems = total - actualStart;
  const totalBatches = Math.ceil(remainingItems / concurrency);
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = actualStart + batchIndex * concurrency;
    const end = Math.min(start + concurrency, total);
    const batch = items.slice(start, end);
    
    if (onBatchStart) {
      onBatchStart(batch, batchIndex + 1, totalBatches);
    }
    
    await Promise.all(batch.map(item => asyncFn(item)));
    
    if (onBatchComplete) {
      onBatchComplete(batch, batchIndex + 1, totalBatches);
    }
  }
  
  return items;
}