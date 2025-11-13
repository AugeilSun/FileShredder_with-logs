const fs = require('fs');
const path = require('path');
const Utils = require('./utils');
const { app } = require('electron');

/**
 * 状态管理模块
 * 负责保存和恢复应用程序状态，实现异常退出后的恢复机制
 */
class StateManager {
  constructor(logger = null) {
    // 获取用户数据目录，确保在打包后的应用程序中也能正确创建状态目录
    const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../logs');
    this.stateDir = path.join(userDataPath, 'logs');
    this.stateFilePath = path.join(this.stateDir, 'app-state.json');
    
    // 确保状态目录存在
    try {
      Utils.ensureDirectoryExists(this.stateDir);
    } catch (error) {
      console.error('创建状态目录失败:', error);
      // 如果无法创建状态目录，使用临时目录
      this.stateDir = path.join(require('os').tmpdir(), 'file-shredder-logs');
      this.stateFilePath = path.join(this.stateDir, 'app-state.json');
      Utils.ensureDirectoryExists(this.stateDir);
    }
    
    // 日志记录器
    this.logger = logger;
    
    // 当前状态
    this.currentState = this.loadState();
  }

  /**
   * 加载应用程序状态
   * @returns {object} - 应用程序状态
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const stateData = fs.readFileSync(this.stateFilePath, 'utf8');
        const state = JSON.parse(stateData);
        
        // 检查状态是否有效（不超过24小时）
        const stateTime = new Date(state.lastSaved);
        const now = new Date();
        const hoursDiff = (now - stateTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          if (this.logger) {
            this.logger.info('已加载应用程序状态', { 
              shreddingInProgress: state.shreddingInProgress,
              queueLength: state.shreddingQueue ? state.shreddingQueue.length : 0
            });
          }
          return state;
        } else {
          // 状态过期，重置为默认状态
          if (this.logger) {
            this.logger.info('应用程序状态已过期，使用默认状态');
          }
          return this.getDefaultState();
        }
      } else {
        // 状态文件不存在，使用默认状态
        return this.getDefaultState();
      }
    } catch (error) {
      // 读取状态失败，使用默认状态
      if (this.logger) {
        this.logger.error('加载应用程序状态失败', error);
      }
      return this.getDefaultState();
    }
  }

  /**
   * 获取默认状态
   * @returns {object} - 默认状态
   */
  getDefaultState() {
    return {
      shreddingInProgress: false,
      shreddingQueue: [],
      lastSaved: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * 保存应用程序状态
   * @param {object} state - 要保存的状态
   */
  saveState(state = null) {
    try {
      const stateToSave = state || this.currentState;
      stateToSave.lastSaved = new Date().toISOString();
      
      const stateData = JSON.stringify(stateToSave, null, 2);
      fs.writeFileSync(this.stateFilePath, stateData);
      
      if (this.logger) {
        this.logger.info('应用程序状态已保存');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('保存应用程序状态失败', error);
      }
    }
  }

  /**
   * 更新当前状态
   * @param {object} newState - 新状态
   */
  updateState(newState) {
    this.currentState = { ...this.currentState, ...newState };
    this.saveState();
  }

  /**
   * 获取当前状态
   * @returns {object} - 当前状态
   */
  getCurrentState() {
    return { ...this.currentState };
  }

  /**
   * 检查是否有未完成的粉碎任务
   * @returns {boolean} - 是否有未完成的任务
   */
  hasIncompleteTasks() {
    return this.currentState.shreddingInProgress || 
           (this.currentState.shreddingQueue && 
            this.currentState.shreddingQueue.some(item => item.status === 'processing' || item.status === 'pending'));
  }

  /**
   * 获取未完成的任务
   * @returns {array} - 未完成的任务列表
   */
  getIncompleteTasks() {
    if (!this.currentState.shreddingQueue) return [];
    
    return this.currentState.shreddingQueue.filter(item => 
      item.status === 'processing' || item.status === 'pending'
    );
  }

  /**
   * 重置粉碎状态
   */
  resetShreddingState() {
    this.updateState({
      shreddingInProgress: false,
      shreddingQueue: []
    });
  }

  /**
   * 更新粉碎队列
   * @param {array} queue - 粉碎队列
   */
  updateShreddingQueue(queue) {
    this.updateState({
      shreddingQueue: queue
    });
  }

  /**
   * 设置粉碎进行中状态
   * @param {boolean} inProgress - 是否进行中
   */
  setShreddingInProgress(inProgress) {
    this.updateState({
      shreddingInProgress: inProgress
    });
  }

  /**
   * 清理旧状态文件
   */
  cleanupOldStates() {
    try {
      // 当前实现只有一个状态文件，所以不需要清理
      // 如果将来有多个状态文件，可以在这里实现清理逻辑
      
      if (this.logger) {
        this.logger.info('状态清理完成');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('清理旧状态失败', error);
      }
    }
  }

  /**
   * 创建应用程序崩溃恢复信息
   * @returns {object} - 恢复信息
   */
  createRecoveryInfo() {
    const incompleteTasks = this.getIncompleteTasks();
    
    return {
      hasIncompleteTasks: incompleteTasks.length > 0,
      incompleteTasksCount: incompleteTasks.length,
      incompleteTasks: incompleteTasks.map(task => ({
        path: task.path,
        isDirectory: task.isDirectory,
        status: task.status,
        progress: task.progress
      })),
      shreddingInProgress: this.currentState.shreddingInProgress
    };
  }

  /**
   * 检查应用程序是否异常退出
   * @returns {boolean} - 是否异常退出
   */
  isAbnormalExit() {
    // 始终返回 false，禁用异常退出检查
    return false;
    
    // 原始代码：
    // 如果上次状态显示粉碎正在进行中，但当前没有活动进程，则可能是异常退出
    // return this.currentState.shreddingInProgress;
  }

  /**
   * 处理异常退出恢复
   * @returns {object} - 恢复结果
   */
  handleAbnormalExitRecovery() {
    if (!this.isAbnormalExit()) {
      return { recovered: false, reason: '未检测到异常退出' };
    }
    
    const recoveryInfo = this.createRecoveryInfo();
    
    // 重置粉碎状态
    this.resetShreddingState();
    
    if (this.logger) {
      this.logger.info('检测到异常退出，已重置状态', recoveryInfo);
    }
    
    return {
      recovered: true,
      reason: '检测到异常退出，已重置粉碎状态',
      previousTasks: recoveryInfo.incompleteTasks
    };
  }
}

module.exports = StateManager;