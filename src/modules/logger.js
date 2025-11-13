const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * 日志系统模块
 * 负责记录应用程序运行日志和文件粉碎日志
 */
class Logger {
  constructor() {
    // 获取用户数据目录，确保在打包后的应用程序中也能正确创建日志目录
    const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../logs');
    this.logsDir = path.join(userDataPath, 'logs');
    
    // 确保日志目录存在
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('创建日志目录失败:', error);
      // 如果无法创建日志目录，使用临时目录
      this.logsDir = path.join(require('os').tmpdir(), 'file-shredder-logs');
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    }
    
    // 应用程序日志文件路径
    this.appLogPath = path.join(this.logsDir, 'INFO-log.txt');
    
    // 加密密钥（在实际应用中应该从安全的地方获取）
    this.encryptionKey = crypto.createHash('sha256').update('file-shredder-encryption-key').digest();
    
    // 初始化应用程序日志
    this.initAppLog();
  }

  /**
   * 初始化应用程序日志
   */
  initAppLog() {
    try {
      // 如果日志文件不存在，创建它
      if (!fs.existsSync(this.appLogPath)) {
        fs.writeFileSync(this.appLogPath, `# 文件粉碎机应用程序日志\n# 创建时间: ${new Date().toISOString()}\n\n`);
      }
    } catch (error) {
      console.error('初始化应用程序日志失败:', error);
    }
  }

  /**
   * 获取当前日期的文件粉碎日志路径
   * @returns {string} - 日志文件路径
   */
  getShreddingLogPath() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD格式
    return path.join(this.logsDir, `${dateStr}-log.txt`);
  }

  /**
   * 获取指定日期的文件粉碎日志路径
   * @param {Date|string} date - 日期对象或日期字符串(YYYY-MM-DD)
   * @returns {string} - 日志文件路径
   */
  getShreddingLogPathByDate(date) {
    let dateStr;
    if (date instanceof Date) {
      dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD格式
    } else if (typeof date === 'string') {
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('日期格式不正确，应为YYYY-MM-DD');
      }
      dateStr = date;
    } else {
      throw new Error('日期参数类型不正确，应为Date对象或YYYY-MM-DD格式的字符串');
    }
    
    return path.join(this.logsDir, `${dateStr}-log.txt`);
  }

  /**
   * 获取所有可用的文件粉碎日志日期列表
   * @returns {Array} - 日期字符串数组，格式为YYYY-MM-DD，按降序排列（最新的在前）
   */
  getAvailableLogDates() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const logDates = [];
      
      for (const file of files) {
        // 检查是否是文件粉碎日志文件
        const match = file.match(/^(\d{4}-\d{2}-\d{2})-log\.txt$/);
        if (match) {
          logDates.push(match[1]);
        }
      }
      
      // 按日期降序排序（最新的在前）
      logDates.sort((a, b) => new Date(b) - new Date(a));
      
      return logDates;
    } catch (error) {
      console.error('获取可用日志日期失败:', error);
      return [];
    }
  }

  /**
   * 获取指定日期的日志内容
   * @param {string} logType - 日志类型 ('app' 或 'shredding')
   * @param {Date|string} date - 日期对象或日期字符串(YYYY-MM-DD)，仅对shredding类型有效
   * @returns {string} - 日志内容
   */
  getLogsByDate(logType, date) {
    try {
      let logPath;
      
      if (logType === 'app') {
        // 应用程序日志只有一个文件，忽略日期参数
        logPath = this.appLogPath;
      } else if (logType === 'shredding') {
        // 文件粉碎日志按日期存储
        logPath = this.getShreddingLogPathByDate(date);
      } else {
        throw new Error('无效的日志类型');
      }
      
      // 如果日志文件不存在，返回空字符串
      if (!fs.existsSync(logPath)) {
        return '暂无日志记录';
      }
      
      // 读取日志文件
      const logContent = fs.readFileSync(logPath, 'utf8');
      
      // 如果是文件粉碎日志，需要解密
      if (logType === 'shredding') {
        return this.processShreddingLogs(logContent);
      }
      
      return logContent;
    } catch (error) {
      console.error('获取日志失败:', error);
      return '获取日志失败: ' + error.message;
    }
  }

  /**
   * 加密文本
   * @param {string} text - 要加密的文本
   * @returns {string} - 加密后的文本（Base64编码）
   */
  encryptText(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('加密文本失败:', error);
      return text; // 如果加密失败，返回原始文本
    }
  }

  /**
   * 解密文本
   * @param {string} encryptedText - 加密的文本
   * @returns {string} - 解密后的文本
   */
  decryptText(encryptedText) {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        return encryptedText; // 如果不是加密格式，返回原始文本
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('解密文本失败:', error);
      return encryptedText; // 如果解密失败，返回原始文本
    }
  }

  /**
   * 记录信息级别日志
   * @param {string} message - 日志消息
   * @param {object} meta - 附加元数据
   */
  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  /**
   * 记录警告级别日志
   * @param {string} message - 日志消息
   * @param {object} meta - 附加元数据
   */
  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  /**
   * 记录错误级别日志
   * @param {string} message - 日志消息
   * @param {object} meta - 附加元数据
   */
  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  /**
   * 记录日志到应用程序日志文件
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {object} meta - 附加元数据
   */
  log(level, message, meta = {}) {
    try {
      const timestamp = new Date().toISOString();
      const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
      const logEntry = `[${timestamp}] [${level}] ${message} ${metaStr}\n`;
      
      // 追加到应用程序日志文件
      fs.appendFileSync(this.appLogPath, logEntry);
    } catch (error) {
      console.error('写入日志失败:', error);
    }
  }

  /**
   * 记录文件粉碎日志
   * @param {object} shredInfo - 粉碎信息
   */
  logShredding(shredInfo) {
    try {
      const logPath = this.getShreddingLogPath();
      
      // 如果日志文件不存在，创建它
      if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, `# 文件粉碎日志\n# 日期: ${new Date().toISOString().split('T')[0]}\n\n`);
      }
      
      // 准备日志条目
      const logEntry = {
        timestamp: new Date().toISOString(),
        startTime: shredInfo.startTime,
        endTime: shredInfo.endTime,
        path: shredInfo.path,
        originalSize: shredInfo.originalSize,
        result: shredInfo.result,
        failureReason: shredInfo.failureReason || null
      };
      
      // 加密日志条目
      const encryptedEntry = this.encryptText(JSON.stringify(logEntry));
      
      // 写入日志文件
      fs.appendFileSync(logPath, `${encryptedEntry}\n`);
      
      // 同时记录到应用程序日志
      if (shredInfo.result === 'success') {
        this.info(`文件粉碎成功: ${shredInfo.path}`, { size: shredInfo.originalSize });
      } else {
        this.error(`文件粉碎失败: ${shredInfo.path}`, { 
          reason: shredInfo.failureReason,
          size: shredInfo.originalSize 
        });
      }
    } catch (error) {
      console.error('记录文件粉碎日志失败:', error);
    }
  }

  /**
   * 获取日志内容
   * @param {string} logType - 日志类型 ('app' 或 'shredding')
   * @returns {string} - 日志内容
   */
  getLogs(logType) {
    try {
      let logPath;
      
      if (logType === 'app') {
        logPath = this.appLogPath;
      } else if (logType === 'shredding') {
        logPath = this.getShreddingLogPath();
      } else {
        throw new Error('无效的日志类型');
      }
      
      // 如果日志文件不存在，返回空字符串
      if (!fs.existsSync(logPath)) {
        return '暂无日志记录';
      }
      
      // 读取日志文件
      const logContent = fs.readFileSync(logPath, 'utf8');
      
      // 如果是文件粉碎日志，需要解密
      if (logType === 'shredding') {
        return this.processShreddingLogs(logContent);
      }
      
      return logContent;
    } catch (error) {
      console.error('获取日志失败:', error);
      return '获取日志失败: ' + error.message;
    }
  }

  /**
   * 处理文件粉碎日志（解密并格式化）
   * @param {string} logContent - 原始日志内容
   * @returns {string} - 处理后的日志内容
   */
  processShreddingLogs(logContent) {
    try {
      const lines = logContent.split('\n').filter(line => line.trim() !== '');
      const processedLogs = [];
      
      for (const line of lines) {
        // 跳过注释行
        if (line.startsWith('#')) {
          processedLogs.push(line);
          continue;
        }
        
        try {
          // 解密日志条目
          const decryptedEntry = this.decryptText(line);
          const logEntry = JSON.parse(decryptedEntry);
          
          // 格式化日志条目
          const formattedEntry = [
            `时间: ${new Date(logEntry.timestamp).toLocaleString()}`,
            `路径: ${logEntry.path}`,
            `大小: ${this.formatFileSize(logEntry.originalSize)}`,
            `结果: ${logEntry.result === 'success' ? '粉碎成功' : '失败'}`,
            logEntry.failureReason ? `失败原因: ${logEntry.failureReason}` : '',
            `开始时间: ${new Date(logEntry.startTime).toLocaleString()}`,
            `结束时间: ${new Date(logEntry.endTime).toLocaleString()}`,
            '---'
          ].filter(Boolean).join('\n');
          
          processedLogs.push(formattedEntry);
        } catch (error) {
          // 如果解密或解析失败，保留原始行
          processedLogs.push(`无法解析的日志条目: ${line}`);
        }
      }
      
      return processedLogs.join('\n');
    } catch (error) {
      console.error('处理文件粉碎日志失败:', error);
      return '处理日志失败: ' + error.message;
    }
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 清理旧日志（保留最近30天）
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logsDir);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      for (const file of files) {
        // 跳过应用程序日志文件
        if (file === 'INFO-log.txt') continue;
        
        // 检查是否是文件粉碎日志文件
        const match = file.match(/^(\d{4}-\d{2}-\d{2})-log\.txt$/);
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < thirtyDaysAgo) {
            const filePath = path.join(this.logsDir, file);
            fs.unlinkSync(filePath);
            this.info(`已删除旧日志文件: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('清理旧日志失败:', error);
    }
  }
}

module.exports = Logger;