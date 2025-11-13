const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 工具函数模块
 * 提供通用的辅助函数
 */
class Utils {
  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取文件扩展名
   * @param {string} filePath - 文件路径
   * @returns {string} - 文件扩展名
   */
  static getFileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * 生成随机字符串
   * @param {number} length - 字符串长度
   * @returns {string} - 随机字符串
   */
  static generateRandomString(length = 10) {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  /**
   * 检查文件是否被锁定
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 文件是否被锁定
   */
  static isFileLocked(filePath) {
    try {
      // 尝试以独占模式打开文件
      const fd = fs.openSync(filePath, 'r+');
      fs.closeSync(fd);
      return false;
    } catch (error) {
      // 如果打开失败，可能是文件被锁定
      return error.code === 'EBUSY' || error.code === 'EPERM';
    }
  }

  /**
   * 检查路径是否存在
   * @param {string} filePath - 文件或目录路径
   * @returns {boolean} - 路径是否存在
   */
  static pathExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取文件或目录信息
   * @param {string} filePath - 文件或目录路径
   * @returns {object|null} - 文件信息对象或null
   */
  static getPathInfo(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 递归获取目录中的所有文件
   * @param {string} dirPath - 目录路径
   * @returns {array} - 文件路径数组
   */
  static getAllFilesInDirectory(dirPath) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          // 递归获取子目录中的文件
          const subFiles = this.getAllFilesInDirectory(itemPath);
          files.push(...subFiles);
        } else {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`获取目录文件失败: ${dirPath}`, error);
    }
    
    return files;
  }

  /**
   * 计算文件或目录的总大小
   * @param {string} filePath - 文件或目录路径
   * @returns {number} - 总大小（字节）
   */
  static calculateTotalSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        return stats.size;
      } else if (stats.isDirectory()) {
        let totalSize = 0;
        const files = this.getAllFilesInDirectory(filePath);
        
        for (const file of files) {
          const fileStats = fs.statSync(file);
          totalSize += fileStats.size;
        }
        
        return totalSize;
      }
      
      return 0;
    } catch (error) {
      console.error(`计算大小失败: ${filePath}`, error);
      return 0;
    }
  }

  /**
   * 创建安全的临时文件名
   * @param {string} originalPath - 原始文件路径
   * @returns {string} - 安全的临时文件名
   */
  static createSecureTempFileName(originalPath) {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const randomName = this.generateRandomString(16);
    return path.join(dir, `${randomName}${ext}`);
  }

  /**
   * 检查是否有足够的磁盘空间
   * @param {string} dirPath - 目录路径
   * @param {number} requiredSpace - 所需空间（字节）
   * @returns {boolean} - 是否有足够空间
   */
  static hasEnoughDiskSpace(dirPath, requiredSpace) {
    try {
      // 在Windows上，我们可以使用statfs来检查磁盘空间
      // 但Node.js没有内置的statfs支持，这里简化处理
      // 在实际应用中，可能需要使用第三方库
      
      // 简单检查：尝试创建一个临时文件来测试空间
      const testFile = path.join(dirPath, `.space-test-${Date.now()}`);
      const testBuffer = Buffer.alloc(1024); // 1KB测试文件
      
      // 尝试写入测试文件
      fs.writeFileSync(testFile, testBuffer);
      
      // 如果成功，删除测试文件并返回true
      fs.unlinkSync(testFile);
      
      // 这是一个简化的检查，实际应用中可能需要更精确的方法
      return true;
    } catch (error) {
      // 如果无法创建测试文件，可能是空间不足
      return false;
    }
  }

  /**
   * 获取系统信息
   * @returns {object} - 系统信息对象
   */
  static getSystemInfo() {
    const os = require('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus(),
      hostname: os.hostname(),
      uptime: os.uptime()
    };
  }

  /**
   * 延迟执行
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise} - Promise对象
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试操作
   * @param {function} fn - 要重试的函数
   * @param {number} maxRetries - 最大重试次数
   * @param {number} delayMs - 重试间隔（毫秒）
   * @returns {Promise} - Promise对象
   */
  static async retry(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (i < maxRetries) {
          await this.delay(delayMs);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 创建目录（如果不存在）
   * @param {string} dirPath - 目录路径
   * @returns {boolean} - 是否成功创建或已存在
   */
  static ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      console.error(`创建目录失败: ${dirPath}`, error);
      return false;
    }
  }

  /**
   * 获取磁盘剩余空间
   * @param {string} dirPath - 目录路径
   * @returns {number} - 剩余空间（字节）
   */
  static getFreeDiskSpace(dirPath) {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // 在Windows上，我们可以使用statfs来检查磁盘空间
      // 但Node.js没有内置的statfs支持，这里使用一个近似方法
      // 在实际应用中，可能需要使用第三方库如 'drivelist' 或 'diskusage'
      
      // 简单检查：尝试创建一个较大的临时文件来估算空间
      // 注意：这种方法不精确，仅作为示例
      const testFile = path.join(dirPath, `.space-test-${Date.now()}`);
      const testSize = 1024 * 1024; // 1MB测试文件
      
      try {
        // 尝试写入1MB数据
        const testBuffer = Buffer.alloc(testSize);
        fs.writeFileSync(testFile, testBuffer);
        
        // 如果成功，删除测试文件
        fs.unlinkSync(testFile);
        
        // 假设至少有1MB空间，实际应用中需要更精确的方法
        // 这里返回一个较大的值，表示有足够空间
        return 1024 * 1024 * 1024; // 1GB
      } catch (error) {
        // 如果无法创建1MB文件，尝试更小的文件
        try {
          const smallTestSize = 1024; // 1KB
          const smallTestBuffer = Buffer.alloc(smallTestSize);
          fs.writeFileSync(testFile, smallTestBuffer);
          fs.unlinkSync(testFile);
          
          // 假设只有少量空间
          return 1024 * 100; // 100KB
        } catch (smallError) {
          // 连1KB都无法创建，假设没有空间
          return 0;
        }
      }
    } catch (error) {
      console.error(`获取磁盘空间失败: ${dirPath}`, error);
      return 0;
    }
  }

  /**
   * 检查文件是否为系统关键文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 是否为系统关键文件
   */
  static isSystemCriticalFile(filePath) {
    const normalizedPath = path.normalize(filePath).toLowerCase();
    
    // Windows系统关键路径
    const systemPaths = [
      'c:\\windows',
      'c:\\program files',
      'c:\\program files (x86)',
      'c:\\programdata',
      'c:\\users\\default',
      'c:\\users\\public',
      'c:\\recovery',
      'c:\\system volume information'
    ];
    
    // 检查是否在系统路径下
    for (const sysPath of systemPaths) {
      if (normalizedPath.startsWith(sysPath)) {
        return true;
      }
    }
    
    // 检查是否为系统关键文件扩展名
    const systemExtensions = [
      '.sys', '.dll', '.exe', '.bat', '.cmd', '.com', '.scr',
      '.cpl', '.msc', '.msp', '.msi', '.ps1', '.vbs', '.js',
      '.reg', '.inf', '.ini', '.log', '.evt', '.evtx'
    ];
    
    const ext = path.extname(normalizedPath);
    if (systemExtensions.includes(ext)) {
      // 进一步检查是否在系统目录中
      for (const sysPath of systemPaths) {
        if (normalizedPath.startsWith(sysPath)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 验证文件路径是否安全
   * @param {string} filePath - 文件路径
   * @returns {object} - 验证结果
   */
  static validateFilePath(filePath) {
    const result = {
      isValid: true,
      errors: []
    };
    
    // 检查路径是否为空
    if (!filePath || filePath.trim() === '') {
      result.isValid = false;
      result.errors.push('文件路径不能为空');
      return result;
    }
    
    // 检查路径是否存在
    if (!this.pathExists(filePath)) {
      result.isValid = false;
      result.errors.push('文件或目录不存在');
      return result;
    }
    
    // 检查是否为系统关键文件
    if (this.isSystemCriticalFile(filePath)) {
      result.isValid = false;
      result.errors.push('不能粉碎系统关键文件');
      return result;
    }
    
    // 检查文件是否被锁定
    if (this.isFileLocked(filePath)) {
      result.isValid = false;
      result.errors.push('文件被其他程序占用');
      return result;
    }
    
    // 检查路径长度（Windows限制）
    if (filePath.length > 260) {
      result.isValid = false;
      result.errors.push('文件路径过长');
      return result;
    }
    
    return result;
  }

  /**
   * 生成安全的随机数据
   * @param {number} size - 数据大小（字节）
   * @returns {Buffer} - 随机数据缓冲区
   */
  static generateSecureRandomData(size) {
    try {
      return crypto.randomBytes(size);
    } catch (error) {
      console.error('生成安全随机数据失败:', error);
      // 如果失败，使用伪随机数作为后备
      const buffer = Buffer.allocUnsafe(size);
      for (let i = 0; i < size; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    }
  }

  /**
   * 安全地比较两个缓冲区
   * @param {Buffer} a - 缓冲区A
   * @param {Buffer} b - 缓冲区B
   * @returns {boolean} - 是否相等
   */
  static safeBufferCompare(a, b) {
    try {
      // 使用crypto.timingSafeEqual防止时序攻击
      if (a.length !== b.length) {
        return false;
      }
      return crypto.timingSafeEqual(a, b);
    } catch (error) {
      // 如果不支持timingSafeEqual，使用常规比较
      if (a.length !== b.length) {
        return false;
      }
      
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      
      return true;
    }
  }

  /**
   * 创建安全的临时目录
   * @param {string} baseDir - 基础目录
   * @returns {string|null} - 临时目录路径或null
   */
  static createSecureTempDir(baseDir = null) {
    try {
      const os = require('os');
      const path = require('path');
      
      // 如果未指定基础目录，使用系统临时目录
      const tempBaseDir = baseDir || os.tmpdir();
      
      // 生成随机目录名
      const randomDirName = this.generateRandomString(16);
      const tempDirPath = path.join(tempBaseDir, `shredder-temp-${randomDirName}`);
      
      // 创建目录
      if (!this.ensureDirectoryExists(tempDirPath)) {
        return null;
      }
      
      return tempDirPath;
    } catch (error) {
      console.error('创建临时目录失败:', error);
      return null;
    }
  }

  /**
   * 安全地清理临时目录
   * @param {string} tempDirPath - 临时目录路径
   * @returns {boolean} - 是否成功清理
   */
  static cleanupTempDir(tempDirPath) {
    try {
      if (!tempDirPath || !this.pathExists(tempDirPath)) {
        return true; // 已经不存在，视为成功
      }
      
      return this.safeDelete(tempDirPath);
    } catch (error) {
      console.error('清理临时目录失败:', error);
      return false;
    }
  }

  /**
   * 安全地删除文件或目录
   * @param {string} targetPath - 目标路径
   * @returns {boolean} - 是否成功删除
   */
  static safeDelete(targetPath) {
    try {
      if (!fs.existsSync(targetPath)) {
        return true; // 已经不存在，视为成功
      }

      const stats = fs.statSync(targetPath);
      
      if (stats.isDirectory()) {
        // 递归删除目录
        const items = fs.readdirSync(targetPath);
        
        for (const item of items) {
          const itemPath = path.join(targetPath, item);
          this.safeDelete(itemPath);
        }
        
        fs.rmdirSync(targetPath);
      } else {
        // 删除文件
        fs.unlinkSync(targetPath);
      }
      
      return true;
    } catch (error) {
      console.error(`删除失败: ${targetPath}`, error);
      return false;
    }
  }
}

module.exports = Utils;