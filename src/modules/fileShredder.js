const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Utils = require('./utils');

/**
 * 文件粉碎器模块
 * 按照美国国防部DoD 5220.22-M标准实现文件粉碎功能
 */
class FileShredder {
  constructor(logger = null) {
    // DoD 5220.22-M标准覆盖模式
    this.dodPatterns = [
      { pattern: 0x00, description: '零覆盖' },
      { pattern: 0xFF, description: '一覆盖' },
      { pattern: 'random', description: '随机覆盖' }
    ];
    
    // Gutmann方法覆盖模式
    this.gutmannPatterns = [
      // 4次随机数据覆盖
      { pattern: 'random', description: '随机覆盖' },
      { pattern: 'random', description: '随机覆盖' },
      { pattern: 'random', description: '随机覆盖' },
      { pattern: 'random', description: '随机覆盖' },
      
      // 27次特定模式覆盖
      { pattern: 0x55, description: '模式1' },
      { pattern: 0xAA, description: '模式2' },
      { pattern: 0x92, description: '模式3' },
      { pattern: 0x49, description: '模式4' },
      { pattern: 0x24, description: '模式5' },
      { pattern: 0x92, description: '模式6' },
      { pattern: 0x49, description: '模式7' },
      { pattern: 0x24, description: '模式8' },
      { pattern: 0x55, description: '模式9' },
      { pattern: 0xAA, description: '模式10' },
      { pattern: 0x92, description: '模式11' },
      { pattern: 0x49, description: '模式12' },
      { pattern: 0x24, description: '模式13' },
      { pattern: 0x92, description: '模式14' },
      { pattern: 0x49, description: '模式15' },
      { pattern: 0x24, description: '模式16' },
      { pattern: 0x55, description: '模式17' },
      { pattern: 0xAA, description: '模式18' },
      { pattern: 0x92, description: '模式19' },
      { pattern: 0x49, description: '模式20' },
      { pattern: 0x24, description: '模式21' },
      { pattern: 0x92, description: '模式22' },
      { pattern: 0x49, description: '模式23' },
      { pattern: 0x24, description: '模式24' },
      { pattern: 0x55, description: '模式25' },
      { pattern: 0xAA, description: '模式26' },
      { pattern: 0x92, description: '模式27' },
      
      // 最后4次随机数据覆盖
      { pattern: 'random', description: '随机覆盖' },
      { pattern: 'random', description: '随机覆盖' },
      { pattern: 'random', description: '随机覆盖' },
      { pattern: 'random', description: '随机覆盖' }
    ];
    
    // 缓冲区大小（1MB）
    this.bufferSize = 1024 * 1024;
    
    // 日志记录器
    this.logger = logger;
  }

  /**
   * 粉碎文件或文件夹
   * @param {string} filePath - 文件或文件夹路径
   * @param {boolean} isDirectory - 是否为文件夹
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise} - 返回Promise对象
   */
  async shredFile(filePath, isDirectory, progressCallback) {
    const startTime = new Date().toISOString();
    let originalSize = 0;
    let result = 'success';
    let failureReason = null;
    
    try {
      // 验证文件路径
      const validation = Utils.validateFilePath(filePath);
      if (!validation.isValid) {
        throw new Error(`文件验证失败: ${validation.errors.join(', ')}`);
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      
      // 检查文件是否被锁定
      if (Utils.isFileLocked(filePath)) {
        throw new Error(`文件被锁定，无法粉碎: ${filePath}`);
      }
      
      // 获取原始文件大小
      originalSize = Utils.calculateTotalSize(filePath);
      
      // 检查文件大小，防止处理过大文件导致系统问题
      const maxFileSize = 5 * 1024 * 1024 * 1024; // 5GB
      if (!isDirectory && originalSize > maxFileSize) {
        throw new Error(`文件过大，无法粉碎: ${Utils.formatFileSize(originalSize)}`);
      }
      
      if (isDirectory) {
        await this.shredDirectory(filePath, progressCallback);
      } else {
        await this.shredSingleFile(filePath, progressCallback);
      }
    } catch (error) {
      result = 'failed';
      failureReason = error.message;
      throw error;
    } finally {
      // 记录粉碎日志
      if (this.logger) {
        this.logger.logShredding({
          startTime,
          endTime: new Date().toISOString(),
          path: filePath,
          originalSize,
          result,
          failureReason
        });
      }
    }
  }

  /**
   * 粉碎单个文件
   * @param {string} filePath - 文件路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise} - 返回Promise对象
   */
  async shredSingleFile(filePath, progressCallback) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 执行DoD 5220.22-M标准的三次覆盖
      await this.performDoDWipe(filePath, progressCallback);
      
      // 安全措施：多次重命名后再删除
      this.secureDeleteFileName(filePath);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 覆盖文件数据
   * @param {number} fileDescriptor - 文件描述符
   * @param {number} fileSize - 文件大小
   * @param {Buffer} buffer - 缓冲区
   * @param {number|null} byteValue - 覆盖字节值（null表示随机数据）
   * @returns {Promise<void>}
   */
  async overwriteFile(fileDescriptor, fileSize, buffer, byteValue) {
    // 重置文件指针到开头
    fs.fsyncSync(fileDescriptor);
    
    // 使用更大的缓冲区提高性能
    const bufferSize = Math.min(buffer.length, 1024 * 1024); // 最大1MB缓冲区
    const fullBuffers = Math.floor(fileSize / bufferSize);
    const remainingBytes = fileSize % bufferSize;
    
    // 准备覆盖数据
    let overwriteBuffer;
    if (byteValue === null) {
      // 随机数据 - 使用Utils生成安全随机数据提高性能和安全性
      overwriteBuffer = Utils.generateSecureRandomData(bufferSize);
    } else {
      // 固定值数据
      overwriteBuffer = Buffer.alloc(bufferSize, byteValue);
    }
    
    // 写入完整缓冲区
    for (let i = 0; i < fullBuffers; i++) {
      // 如果是随机数据，每次生成新的随机数据以提高安全性
      if (byteValue === null) {
        overwriteBuffer = Utils.generateSecureRandomData(bufferSize);
      }
      
      fs.writeSync(fileDescriptor, overwriteBuffer, 0, bufferSize, i * bufferSize);
    }
    
    // 写入剩余字节
    if (remainingBytes > 0) {
      let remainingBuffer;
      if (byteValue === null) {
        // 为剩余字节生成新的随机数据
        remainingBuffer = Utils.generateSecureRandomData(remainingBytes);
      } else {
        remainingBuffer = overwriteBuffer.slice(0, remainingBytes);
      }
      fs.writeSync(fileDescriptor, remainingBuffer, 0, remainingBytes, fullBuffers * bufferSize);
    }
    
    // 同步到磁盘
    fs.fsyncSync(fileDescriptor);
  }

  /**
   * 执行快速粉碎（1次随机覆盖）
   * @param {string} filePath - 文件路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise<void>}
   */
  async performQuickWipe(filePath, progressCallback = null) {
    try {
      // 使用随机数据覆盖文件
      await FileShredder.overwriteFileWithPattern(filePath, null, progressCallback, 0, 100);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 执行DoD 5220.22-M标准粉碎（3次覆盖）
   * @param {string} filePath - 文件路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise<void>}
   */
  async performDoDWipe(filePath, progressCallback = null) {
    try {
      await this.performDoDWipeInternal(filePath, progressCallback);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 执行DoD 5220.22-M标准的三次覆盖（内部方法）
   * @param {string} filePath - 文件路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise} - 返回Promise对象
   */
  async performDoDWipeInternal(filePath, progressCallback) {
    // DoD 5220.22-M标准：3次覆盖
    // 第一次：全零
    // 第二次：全一
    // 第三次：随机数据
    const patterns = [
      0, // 全零
      255, // 全一
      null // 随机数据
    ];
    
    // 计算总操作次数
    const totalOperations = patterns.length;
    
    // 执行覆盖操作
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const progressStart = (i / totalOperations) * 100;
      const progressEnd = ((i + 1) / totalOperations) * 100;
      
      await FileShredder.overwriteFileWithPattern(filePath, pattern, progressCallback, progressStart, progressEnd);
    }
  }

  /**
   * 执行Gutmann方法粉碎（35次覆盖）
   * @param {string} filePath - 文件路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise<void>}
   */
  async performGutmannWipe(filePath, progressCallback = null) {
    try {
      // 计算总操作次数
      const totalOperations = this.gutmannPatterns.length;
      
      // 执行覆盖操作
      for (let i = 0; i < this.gutmannPatterns.length; i++) {
        const pattern = this.gutmannPatterns[i];
        const progressStart = (i / totalOperations) * 100;
        const progressEnd = ((i + 1) / totalOperations) * 100;
        
        // 提取模式值，如果是字符串'random'则传递null
        const patternValue = pattern.pattern === 'random' ? null : pattern.pattern;
        await FileShredder.overwriteFileWithPattern(filePath, patternValue, progressCallback, progressStart, progressEnd);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * 使用特定模式覆盖文件
   * @param {string} filePath - 文件路径
   * @param {number|null} pattern - 覆盖模式（0x00, 0xFF或null表示随机）
   * @param {function} progressCallback - 进度回调函数
   * @param {number} startProgress - 起始进度
   * @param {number} endProgress - 结束进度
   * @returns {Promise<void>}
   */
  static async overwriteFileWithPattern(filePath, pattern, progressCallback, startProgress, endProgress) {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // 使用更大的缓冲区提高性能
    const bufferSize = Math.min(1024 * 1024, fileSize); // 最大1MB缓冲区
    const fileDescriptor = fs.openSync(filePath, 'r+');
    
    try {
      // 计算需要写入的完整缓冲区次数和剩余字节数
      const fullBuffers = Math.floor(fileSize / bufferSize);
      const remainingBytes = fileSize % bufferSize;
      
      // 准备覆盖缓冲区
      let overwriteBuffer;
      if (pattern === null) {
        // 随机数据 - 使用Utils生成安全随机数据提高性能和安全性
        overwriteBuffer = Utils.generateSecureRandomData(bufferSize);
      } else {
        // 固定值数据
        overwriteBuffer = Buffer.alloc(bufferSize, pattern);
      }
      
      // 写入完整的缓冲区
      for (let i = 0; i < fullBuffers; i++) {
        // 如果是随机数据，每次生成新的随机数据以提高安全性
        if (pattern === null) {
          overwriteBuffer = Utils.generateSecureRandomData(bufferSize);
        }
        
        fs.writeSync(fileDescriptor, overwriteBuffer, 0, bufferSize, i * bufferSize);
        
        // 更新进度
        if (progressCallback) {
          const progress = startProgress + (endProgress - startProgress) * ((i + 1) * bufferSize / fileSize);
          progressCallback(Math.round(progress));
        }
        
        // 每写入一定量数据后短暂休息，避免系统负载过高
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      // 写入剩余字节
      if (remainingBytes > 0) {
        let remainingBuffer;
        if (pattern === null) {
          // 为剩余字节生成新的随机数据
          remainingBuffer = Utils.generateSecureRandomData(remainingBytes);
        } else {
          remainingBuffer = overwriteBuffer.slice(0, remainingBytes);
        }
        
        fs.writeSync(fileDescriptor, remainingBuffer, 0, remainingBytes, fullBuffers * bufferSize);
      }
      
      // 确保数据写入磁盘
      fs.fsyncSync(fileDescriptor);
    } finally {
      fs.closeSync(fileDescriptor);
    }
  }

  /**
   * 粉碎文件
   * @param {string} filePath - 文件路径
   * @param {string} method - 粉碎方法
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise<boolean>} - 返回是否成功
   */
  static async shredFile(filePath, method = 'dod', progressCallback = null) {
    try {
      // 验证文件路径
      if (!Utils.validateFilePath(filePath)) {
        throw new Error('文件路径包含非法字符');
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error('文件不存在');
      }

      // 获取文件大小
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // 检查文件大小限制（5GB）
      const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
      if (fileSize > maxSize) {
        throw new Error(`文件过大，超过${Utils.formatFileSize(maxSize)}限制`);
      }

      // 创建安全临时目录
      const tempDir = await Utils.createSecureTempDir();
      if (!tempDir) {
        throw new Error('无法创建安全的临时目录');
      }

      // 创建文件粉碎器实例
      const shredder = new FileShredder();
      
      // 根据粉碎方法执行不同的覆盖策略
      switch (method) {
        case 'quick':
          // 快速粉碎：1次随机覆盖
          await shredder.performQuickWipe(filePath, progressCallback);
          break;
        case 'dod':
          // DoD 5220.22-M标准：3次覆盖
          await shredder.performDoDWipe(filePath, progressCallback);
          break;
        case 'gutmann':
          // Gutmann方法：35次覆盖
          await shredder.performGutmannWipe(filePath, progressCallback);
          break;
        default:
          throw new Error('未知的粉碎方法');
      }

      // 多次重命名文件，增加恢复难度
      const originalName = path.basename(filePath);
      const dir = path.dirname(filePath);
      
      for (let i = 0; i < 10; i++) {
        const randomName = Utils.generateSecureRandomData(16).toString('hex');
        const newPath = path.join(dir, randomName);
        fs.renameSync(filePath, newPath);
        filePath = newPath;
      }

      // 最后一步：删除文件
      fs.unlinkSync(filePath);

      // 更新进度到100%
      if (progressCallback) {
        progressCallback(100);
      }

      // 清理临时目录
      await Utils.cleanupTempDir(tempDir);

      return true;
    } catch (error) {
      console.error(`粉碎文件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 安全删除文件名（通过多次重命名）
   * @param {string} originalPath - 原始文件路径
   */
  secureDeleteFileName(originalPath) {
    try {
      const dir = path.dirname(originalPath);
      const ext = path.extname(originalPath);
      
      // 生成随机文件名
      let currentPath = originalPath;
      
      // 多次重命名，每次使用更短的随机名称
      for (let i = 0; i < 5; i++) {
        const randomName = crypto.randomBytes(Math.max(8, 16 - i * 2)).toString('hex');
        const newPath = path.join(dir, `${randomName}${ext}`);
        
        try {
          fs.renameSync(currentPath, newPath);
          currentPath = newPath;
        } catch (error) {
          // 如果重命名失败，可能是文件已被删除或其他原因
          break;
        }
      }
      
      // 最后一次尝试删除
      try {
        fs.unlinkSync(currentPath);
      } catch (error) {
        // 忽略删除错误，文件可能已被删除
      }
    } catch (error) {
      // 忽略文件名安全删除过程中的错误
    }
  }

  /**
   * 粉碎目录
   * @param {string} dirPath - 目录路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise} - 返回Promise对象
   */
  async shredDirectory(dirPath, progressCallback) {
    try {
      // 检查目录是否存在
      if (!fs.existsSync(dirPath)) {
        throw new Error(`目录不存在: ${dirPath}`);
      }

      // 获取目录中所有文件和子目录
      const items = fs.readdirSync(dirPath);
      
      // 计算总项目数，用于进度计算
      let totalItems = 0;
      const countItems = (currentPath) => {
        const stats = fs.statSync(currentPath);
        if (stats.isDirectory()) {
          const subItems = fs.readdirSync(currentPath);
          totalItems++; // 计算目录本身
          for (const item of subItems) {
            countItems(path.join(currentPath, item));
          }
        } else {
          totalItems++; // 计算文件
        }
      };
      
      for (const item of items) {
        countItems(path.join(dirPath, item));
      }
      
      // 递归处理每个项目
      let processedItems = 0;
      const processItems = async (currentPath) => {
        const stats = fs.statSync(currentPath);
        
        if (stats.isDirectory()) {
          // 处理子目录
          const subItems = fs.readdirSync(currentPath);
          for (const item of subItems) {
            await processItems(path.join(currentPath, item));
          }
          
          // 删除空目录
          try {
            fs.rmdirSync(currentPath);
          } catch (error) {
            // 忽略删除错误
          }
        } else {
          // 处理文件
          await this.shredSingleFile(currentPath, (fileProgress) => {
            // 计算总体进度
            if (progressCallback) {
              const overallProgress = Math.floor(((processedItems + fileProgress / 100) / totalItems) * 100);
              progressCallback(overallProgress);
            }
          });
        }
        
        processedItems++;
        
        // 更新进度
        if (progressCallback) {
          const overallProgress = Math.floor((processedItems / totalItems) * 100);
          progressCallback(overallProgress);
        }
      };
      
      // 处理目录中的所有项目
      for (const item of items) {
        await processItems(path.join(dirPath, item));
      }
      
      // 最后删除主目录
      try {
        fs.rmdirSync(dirPath);
      } catch (error) {
        // 忽略删除错误
      }
      
    } catch (error) {
      throw new Error(`粉碎目录失败: ${error.message}`);
    }
  }

  /**
   * 静态方法：粉碎目录
   * @param {string} dirPath - 目录路径
   * @param {function} progressCallback - 进度回调函数
   * @returns {Promise<boolean>} - 返回是否成功
   */
  static async shredDirectory(dirPath, progressCallback = null) {
    try {
      // 创建文件粉碎器实例
      const shredder = new FileShredder();
      
      // 调用实例方法
      await shredder.shredDirectory(dirPath, progressCallback);
      
      return true;
    } catch (error) {
      console.error(`粉碎目录失败: ${error.message}`);
      return false;
    }
  }
}

module.exports = FileShredder;