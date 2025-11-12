import fs from 'fs';
import path from 'path';
import config from '../config/config.js';

class CheckpointManager {
  constructor() {
    this.checkpointDir = path.join(config.paths.temp, 'checkpoints');
    this.checkpointFile = path.join(this.checkpointDir, 'workflow_checkpoint.json');
    
    // 确保检查点目录存在
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * 保存检查点
   */
  saveCheckpoint(step, data, status = 'completed') {
    try {
      let checkpoint = this.loadCheckpoint();
      
      checkpoint.steps[step] = {
        status: status,
        data: data,
        timestamp: new Date().toISOString(),
      };
      
      checkpoint.lastStep = step;
      checkpoint.updatedAt = new Date().toISOString();
      
      fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
      console.log(`💾 检查点已保存: ${step} (${status})`);
      return true;
    } catch (error) {
      console.error(`❌ 保存检查点失败 (${step}):`, error);
      return false;
    }
  }

  /**
   * 加载检查点
   */
  loadCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        const content = fs.readFileSync(this.checkpointFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('⚠️ 加载检查点失败，将创建新的检查点:', error.message);
    }
    
    return {
      steps: {},
      lastStep: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
  }

  /**
   * 获取指定步骤的数据
   */
  getStepData(step) {
    const checkpoint = this.loadCheckpoint();
    return checkpoint.steps[step]?.data || null;
  }

  /**
   * 检查步骤是否已完成
   */
  isStepCompleted(step) {
    const checkpoint = this.loadCheckpoint();
    return checkpoint.steps[step]?.status === 'completed';
  }

  /**
   * 获取最后完成的步骤
   */
  getLastCompletedStep() {
    const checkpoint = this.loadCheckpoint();
    return checkpoint.lastStep;
  }

  /**
   * 清除检查点
   */
  clearCheckpoint() {
    try {
      if (fs.existsSync(this.checkpointFile)) {
        fs.unlinkSync(this.checkpointFile);
        console.log('🗑️  检查点已清除');
      }
    } catch (error) {
      console.error('❌ 清除检查点失败:', error);
    }
  }

  /**
   * 清除指定步骤之后的所有检查点
   */
  clearAfterStep(step) {
    try {
      const checkpoint = this.loadCheckpoint();
      const stepOrder = [
        'musicAnalysis',
        'visualConcept',
        'storyboard',
        'keyframes',
        'materials',
        'editedVideo',
        'fxVideo',
        'mixedVideo',
        'finalVideo',
      ];
      
      const stepIndex = stepOrder.indexOf(step);
      if (stepIndex >= 0) {
        // 清除该步骤之后的所有步骤
        for (let i = stepIndex + 1; i < stepOrder.length; i++) {
          delete checkpoint.steps[stepOrder[i]];
        }
        
        checkpoint.lastStep = step;
        checkpoint.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
        console.log(`🗑️  已清除步骤 ${step} 之后的所有检查点`);
      }
    } catch (error) {
      console.error('❌ 清除检查点失败:', error);
    }
  }

  /**
   * 保存中间结果到输出目录
   */
  saveIntermediateResult(step, data) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultPath = path.join(config.paths.output, `${step}_${timestamp}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(data, null, 2));
      console.log(`📄 中间结果已保存: ${resultPath}`);
      return resultPath;
    } catch (error) {
      console.error(`❌ 保存中间结果失败 (${step}):`, error);
      return null;
    }
  }
}

export default new CheckpointManager();

