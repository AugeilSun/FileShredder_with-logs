const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FileShredder = require('./modules/fileShredder');
const Logger = require('./modules/logger');
const StateManager = require('./modules/stateManager');
const Utils = require('./modules/utils');

/**
 * 文件粉碎机主进程
 * 负责创建应用程序窗口和处理IPC通信
 */
class FileShredderApp {
  constructor() {
    this.mainWindow = null;
    this.logger = new Logger();
    this.stateManager = new StateManager(this.logger);
    this.fileShredder = new FileShredder(this.logger);
    this.shreddingInProgress = false;
    this.shreddingQueue = [];
    this.setupApp();
  }

  /**
   * 设置应用程序
   */
  setupApp() {
    // 当所有窗口关闭时退出应用
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // 当应用激活时创建窗口（如果不存在）
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // 应用程序准备就绪时创建窗口
    app.whenReady().then(() => {
      this.createWindow();
      this.setupIPC();
      // 移除异常退出检查
      // this.checkForAbnormalExit();
      this.logger.info('应用程序启动完成');
    });

    // 应用程序退出前保存状态
    app.on('before-quit', () => {
      this.saveCurrentState();
    });
  }

  /**
   * 创建主窗口
   */
  createWindow() {
    // 获取应用程序图标路径，处理打包后的路径问题
    let iconPath;
    try {
      iconPath = process.env.NODE_ENV === 'development' 
        ? path.join(__dirname, '../assets/icon.svg')
        : path.join(process.resourcesPath, 'icon.svg');
      
      // 检查图标文件是否存在
      if (!fs.existsSync(iconPath)) {
        console.warn('图标文件不存在，使用默认图标:', iconPath);
        iconPath = undefined; // 使用Electron默认图标
      }
    } catch (error) {
      console.warn('获取图标路径失败，使用默认图标:', error);
      iconPath = undefined; // 使用Electron默认图标
    }

    const windowOptions = {
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      title: '文件粉碎机',
      show: false,
      autoHideMenuBar: true // 隐藏菜单栏
    };
    
    // 只有在图标路径存在时才设置图标
    if (iconPath) {
      windowOptions.icon = iconPath;
    }

    this.mainWindow = new BrowserWindow(windowOptions);

    // 完全禁用菜单栏
    this.mainWindow.setMenuBarVisibility(false);

    // 加载应用页面，处理打包后的路径问题
    const indexPath = process.env.NODE_ENV === 'development'
      ? path.join(__dirname, '../index.html')
      : path.join(__dirname, '../index.html');
    
    this.mainWindow.loadFile(indexPath);

    // 窗口准备好后显示
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    // 开发模式下打开开发者工具
    if (process.argv.includes('--dev')) {
      this.mainWindow.webContents.openDevTools();
    }
    
    // 生产模式下显示控制台
    if (process.argv.includes('--console')) {
      this.mainWindow.webContents.openDevTools();
    }
  }

  /**
   * 设置IPC通信
   */
  setupIPC() {
    // 获取文件信息
    ipcMain.handle('get-file-info', async (event, filePath) => {
      try {
        const stats = fs.statSync(filePath);
        return {
          success: true,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime
        };
      } catch (error) {
        this.logger.error(`获取文件信息失败: ${filePath}`, error);
        return { success: false, error: error.message };
      }
    });

    // 添加文件到粉碎队列
    ipcMain.handle('add-files-to-queue', async (event, filePaths) => {
      try {
        const results = [];
        
        for (const filePath of filePaths) {
          // 检查文件是否存在
          if (!fs.existsSync(filePath)) {
            results.push({
              path: filePath,
              success: false,
              error: '文件或目录不存在'
            });
            continue;
          }
          
          // 获取文件信息
          const stats = fs.statSync(filePath);
          const totalSize = stats.isDirectory() ? Utils.calculateTotalSize(filePath) : stats.size;
          
          // 检查磁盘空间（安全措施）
          try {
            const freeSpace = await Utils.getFreeDiskSpace(path.dirname(filePath));
            
            if (totalSize > freeSpace) {
              results.push({
                path: filePath,
                success: false,
                error: '磁盘空间不足，无法安全粉碎文件'
              });
              continue;
            }
          } catch (diskError) {
            this.logger.warn(`检查磁盘空间失败: ${diskError.message}`);
            // 继续处理，但记录警告
          }
          
          // 检查文件是否被锁定（安全措施）
          if (Utils.isFileLocked(filePath)) {
            results.push({
              path: filePath,
              success: false,
              error: '文件正在被其他程序使用，无法粉碎'
            });
            continue;
          }
          
          // 检查是否已在队列中
          const exists = this.shreddingQueue.some(item => item.path === filePath);
          if (exists) {
            results.push({
              path: filePath,
              success: false,
              error: '文件已在队列中'
            });
            continue;
          }
          
          // 添加到队列
          this.shreddingQueue.push({
            id: Date.now() + Math.random(),
            path: filePath,
            name: path.basename(filePath),
            isDirectory: stats.isDirectory(),
            size: totalSize,
            status: 'pending',
            progress: 0,
            addedAt: new Date()
          });
          
          results.push({
            path: filePath,
            success: true
          });
          
          this.logger.info(`文件已添加到粉碎队列: ${filePath}`);
        }

        // 更新队列状态
        this.updateQueueStatus(this.shreddingQueue);
        
        return { success: true, results, queue: this.shreddingQueue };
      } catch (error) {
        this.logger.error('添加文件到队列失败', error);
        return { success: false, error: error.message };
      }
    });

    // 获取当前队列状态
    ipcMain.handle('get-queue-status', async () => {
      return { success: true, queue: this.shreddingQueue };
    });

    // 开始粉碎
    ipcMain.handle('start-shredding', async () => {
      if (this.shreddingInProgress) {
        return { success: false, error: '粉碎操作正在进行中' };
      }

      if (this.shreddingQueue.length === 0) {
        return { success: false, error: '没有文件需要粉碎' };
      }

      try {
        this.shreddingInProgress = true;
        // 保存状态
        this.saveCurrentState();
        this.logger.info('开始文件粉碎操作');

        // 重置所有文件状态
        this.shreddingQueue.forEach(item => {
          item.status = 'pending';
          item.progress = 0;
        });

        // 逐个处理文件
        for (let i = 0; i < this.shreddingQueue.length; i++) {
          const item = this.shreddingQueue[i];
          
          // 更新状态为处理中
          item.status = 'processing';
          this.mainWindow.webContents.send('queue-updated', this.shreddingQueue);

          try {
            // 创建进度回调
            const progressCallback = (progress) => {
              item.progress = progress;
              this.mainWindow.webContents.send('queue-updated', this.shreddingQueue);
            };

            // 执行粉碎
            await this.fileShredder.shredFile(item.path, item.isDirectory, progressCallback);
            
            // 更新状态为完成
            item.status = 'completed';
            item.progress = 100;
            this.logger.info(`文件粉碎完成: ${item.path}`);
          } catch (error) {
            // 更新状态为失败
            item.status = 'failed';
            this.logger.error(`文件粉碎失败: ${item.path}`, error);
          }

          // 通知渲染进程更新
          this.mainWindow.webContents.send('queue-updated', this.shreddingQueue);
        }

        this.shreddingInProgress = false;
        // 保存状态
        this.saveCurrentState();
        this.logger.info('文件粉碎操作完成');
        
        // 修复：在操作完成后，移除已完成的文件，保留失败的文件
        this.shreddingQueue = this.shreddingQueue.filter(item => item.status === 'failed');
        this.updateQueueStatus(this.shreddingQueue);
        
        return { success: true };
      } catch (error) {
        this.shreddingInProgress = false;
        // 保存状态
        this.saveCurrentState();
        this.logger.error('文件粉碎操作失败', error);
        return { success: false, error: error.message };
      }
    });

    // 清空队列
    ipcMain.handle('clear-queue', async () => {
      if (this.shreddingInProgress) {
        return { success: false, error: '粉碎操作正在进行中，无法清空队列' };
      }

      this.shreddingQueue = [];
      this.logger.info('文件队列已清空');
      return { success: true };
    });

    // 选择文件对话框
    ipcMain.handle('show-file-dialog', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ['openFile', 'multiSelections'],
          title: '选择要粉碎的文件',
          filters: [
            { name: '所有文件', extensions: ['*'] }
          ]
        });

        if (result.canceled) {
          return { success: false, error: '用户取消选择' };
        }

        return { success: true, filePaths: result.filePaths };
      } catch (error) {
        this.logger.error('显示文件对话框失败', error);
        return { success: false, error: error.message };
      }
    });

    // 选择文件夹对话框
    ipcMain.handle('show-folder-dialog', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ['openDirectory'],
          title: '选择要粉碎的文件夹'
        });

        if (result.canceled) {
          return { success: false, error: '用户取消选择' };
        }

        return { success: true, filePaths: result.filePaths };
      } catch (error) {
        this.logger.error('显示文件夹对话框失败', error);
        return { success: false, error: error.message };
      }
    });

    // 获取日志
    ipcMain.handle('get-logs', async (event, logType) => {
      try {
        const logs = this.logger.getLogs(logType);
        return { success: true, logs };
      } catch (error) {
        this.logger.error('获取日志失败', error);
        return { success: false, error: error.message };
      }
    });

    // 获取指定日期的日志
    ipcMain.handle('get-logs-by-date', async (event, logType, date) => {
      try {
        const logs = this.logger.getLogsByDate(logType, date);
        return { success: true, logs };
      } catch (error) {
        this.logger.error('获取指定日期日志失败', error);
        return { success: false, error: error.message };
      }
    });

    // 获取所有可用的日志日期列表
    ipcMain.handle('get-available-log-dates', async () => {
      try {
        const dates = this.logger.getAvailableLogDates();
        return { success: true, dates };
      } catch (error) {
        this.logger.error('获取可用日志日期失败', error);
        return { success: false, error: error.message };
      }
    });

    // 检查异常退出
    ipcMain.handle('check-abnormal-exit', async () => {
      try {
        const recoveryInfo = this.stateManager.createRecoveryInfo();
        return { success: true, recoveryInfo };
      } catch (error) {
        this.logger.error('检查异常退出失败', error);
        return { success: false, error: error.message };
      }
    });

    // 恢复异常退出状态
    ipcMain.handle('recover-from-abnormal-exit', async () => {
      try {
        const recoveryResult = this.stateManager.handleAbnormalExitRecovery();
        return { success: true, recoveryResult };
      } catch (error) {
        this.logger.error('恢复异常退出状态失败', error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * 更新队列状态
   */
  updateQueueStatus(queue) {
    this.shreddingQueue = queue;
    // 保存状态到状态管理器
    this.saveCurrentState();
    
    // 通知渲染进程更新队列
    if (this.mainWindow) {
      this.mainWindow.webContents.send('queue-updated', queue);
    }
  }

  /**
   * 检查异常退出
   */
  checkForAbnormalExit() {
    if (this.stateManager.isAbnormalExit()) {
      this.logger.warn('检测到可能的异常退出');
      
      // 在窗口准备好后通知渲染进程
      setTimeout(() => {
        if (this.mainWindow) {
          this.mainWindow.webContents.send('abnormal-exit-detected', 
            this.stateManager.createRecoveryInfo()
          );
        }
      }, 2000);
    }
  }

  /**
   * 保存当前状态
   */
  saveCurrentState() {
    this.stateManager.updateState({
      shreddingInProgress: this.shreddingInProgress,
      shreddingQueue: this.shreddingQueue
    });
  }
}

// 创建应用程序实例
new FileShredderApp();