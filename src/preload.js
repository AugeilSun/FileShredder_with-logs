const { contextBridge, ipcRenderer } = require('electron');

/**
 * 预加载脚本
 * 在渲染进程中暴露安全的API
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取文件信息
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  
  // 添加文件到队列
  addFilesToQueue: (filePaths) => ipcRenderer.invoke('add-files-to-queue', filePaths),
  
  // 获取队列状态
  getQueueStatus: () => ipcRenderer.invoke('get-queue-status'),
  
  // 开始粉碎
  startShredding: () => ipcRenderer.invoke('start-shredding'),
  
  // 清空队列
  clearQueue: () => ipcRenderer.invoke('clear-queue'),
  
  // 显示文件对话框
  showFileDialog: () => ipcRenderer.invoke('show-file-dialog'),
  
  // 显示文件夹对话框
  showFolderDialog: () => ipcRenderer.invoke('show-folder-dialog'),
  
  // 获取日志
  getLogs: (logType) => ipcRenderer.invoke('get-logs', logType),
  
  // 获取指定日期的日志
  getLogsByDate: (logType, date) => ipcRenderer.invoke('get-logs-by-date', logType, date),
  
  // 获取所有可用的日志日期列表
  getAvailableLogDates: () => ipcRenderer.invoke('get-available-log-dates'),
  
  // 移除异常退出相关IPC通信
  // checkAbnormalExit: () => ipcRenderer.invoke('check-abnormal-exit'),
  // recoverFromAbnormalExit: () => ipcRenderer.invoke('recover-from-abnormal-exit'),
  // onAbnormalExitDetected: (callback) => ipcRenderer.on('abnormal-exit-detected', callback),
  // removeAbnormalExitListener: (callback) => ipcRenderer.removeListener('abnormal-exit-detected', callback),
  
  // 监听队列更新
  onQueueUpdated: (callback) => ipcRenderer.on('queue-updated', callback),
  
  // 移除监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});