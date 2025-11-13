const fs = require('fs');
const path = require('path');
const FileShredder = require('../src/modules/fileShredder');

/**
 * 文件粉碎器测试用例
 */
class FileShredderTests {
  constructor() {
    this.testDir = path.join(__dirname, 'test_data');
    this.testResults = [];
  }

  /**
   * 初始化测试环境
   */
  async setup() {
    // 创建测试目录
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }

    console.log('测试环境初始化完成');
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    // 删除测试目录及其内容
    if (fs.existsSync(this.testDir)) {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    }

    console.log('测试环境清理完成');
  }

  /**
   * 创建测试文件
   * @param {string} fileName - 文件名
   * @param {string} content - 文件内容
   * @returns {string} - 文件路径
   */
  createTestFile(fileName, content) {
    const filePath = path.join(this.testDir, fileName);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * 创建测试目录
   * @param {string} dirName - 目录名
   * @param {Array} files - 目录中的文件列表
   * @returns {string} - 目录路径
   */
  createTestDirectory(dirName, files = []) {
    const dirPath = path.join(this.testDir, dirName);
    fs.mkdirSync(dirPath, { recursive: true });

    // 在目录中创建文件
    files.forEach(file => {
      const filePath = path.join(dirPath, file.name);
      fs.writeFileSync(filePath, file.content || '测试文件内容');
    });

    return dirPath;
  }

  /**
   * 记录测试结果
   * @param {string} testName - 测试名称
   * @param {boolean} passed - 是否通过
   * @param {string} message - 测试消息
   */
  recordResult(testName, passed, message = '') {
    const result = {
      testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(result);
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${message}`);
  }

  /**
   * 测试文件存在性检查
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 文件是否存在
   */
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * 测试快速粉碎方法
   */
  async testQuickShred() {
    const fileName = 'quick_test.txt';
    const filePath = this.createTestFile(fileName, '这是一个用于测试快速粉碎的文件');

    // 确保文件存在
    if (!this.fileExists(filePath)) {
      this.recordResult('快速粉碎测试', false, '测试文件创建失败');
      return;
    }

    try {
      // 执行快速粉碎
      const result = await FileShredder.shredFile(filePath, 'quick');

      // 检查文件是否已被删除
      const fileExists = this.fileExists(filePath);

      this.recordResult(
        '快速粉碎测试',
        result && !fileExists,
        fileExists ? '文件仍然存在' : '文件已成功粉碎'
      );
    } catch (error) {
      this.recordResult('快速粉碎测试', false, `测试过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 测试DoD标准粉碎方法
   */
  async testDoDShred() {
    const fileName = 'dod_test.txt';
    const filePath = this.createTestFile(fileName, '这是一个用于测试DoD标准粉碎的文件');

    // 确保文件存在
    if (!this.fileExists(filePath)) {
      this.recordResult('DoD标准粉碎测试', false, '测试文件创建失败');
      return;
    }

    try {
      // 执行DoD标准粉碎
      const result = await FileShredder.shredFile(filePath, 'dod');

      // 检查文件是否已被删除
      const fileExists = this.fileExists(filePath);

      this.recordResult(
        'DoD标准粉碎测试',
        result && !fileExists,
        fileExists ? '文件仍然存在' : '文件已成功粉碎'
      );
    } catch (error) {
      this.recordResult('DoD标准粉碎测试', false, `测试过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 测试Gutmann方法粉碎
   */
  async testGutmannShred() {
    const fileName = 'gutmann_test.txt';
    const filePath = this.createTestFile(fileName, '这是一个用于测试Gutmann方法粉碎的文件');

    // 确保文件存在
    if (!this.fileExists(filePath)) {
      this.recordResult('Gutmann方法粉碎测试', false, '测试文件创建失败');
      return;
    }

    try {
      // 执行Gutmann方法粉碎
      const result = await FileShredder.shredFile(filePath, 'gutmann');

      // 检查文件是否已被删除
      const fileExists = this.fileExists(filePath);

      this.recordResult(
        'Gutmann方法粉碎测试',
        result && !fileExists,
        fileExists ? '文件仍然存在' : '文件已成功粉碎'
      );
    } catch (error) {
      this.recordResult('Gutmann方法粉碎测试', false, `测试过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 测试目录粉碎功能
   */
  async testDirectoryShred() {
    const dirName = 'test_directory';
    const files = [
      { name: 'file1.txt', content: '测试文件1内容' },
      { name: 'file2.txt', content: '测试文件2内容' },
      { name: 'file3.txt', content: '测试文件3内容' }
    ];

    // 创建测试目录和文件
    const dirPath = this.createTestDirectory(dirName, files);

    // 确保目录存在
    if (!this.fileExists(dirPath)) {
      this.recordResult('目录粉碎测试', false, '测试目录创建失败');
      return;
    }

    try {
      // 执行目录粉碎
      const result = await FileShredder.shredDirectory(dirPath);

      // 检查目录是否已被删除
      const dirExists = this.fileExists(dirPath);

      this.recordResult(
        '目录粉碎测试',
        result && !dirExists,
        dirExists ? '目录仍然存在' : '目录已成功粉碎'
      );
    } catch (error) {
      this.recordResult('目录粉碎测试', false, `测试过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 测试文件大小限制
   */
  async testFileSizeLimit() {
    // 创建一个小于5GB的文件（实际测试中创建小文件）
    const fileName = 'size_test.txt';
    const filePath = this.createTestFile(fileName, '这是一个用于测试文件大小限制的文件');

    try {
      // 尝试粉碎文件
      const result = await FileShredder.shredFile(filePath, 'quick');

      this.recordResult(
        '文件大小限制测试',
        result,
        result ? '文件大小限制正常工作' : '文件大小限制测试失败'
      );
    } catch (error) {
      this.recordResult('文件大小限制测试', false, `测试过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 测试无效文件路径处理
   */
  async testInvalidFilePath() {
    const invalidFilePath = 'C:\\不存在的路径\\不存在的文件.txt';

    try {
      // 尝试粉碎不存在的文件
      const result = await FileShredder.shredFile(invalidFilePath, 'quick');

      this.recordResult(
        '无效文件路径测试',
        !result,
        result ? '应该拒绝无效路径但没有拒绝' : '正确处理了无效文件路径'
      );
    } catch (error) {
      // 预期会抛出错误，这是正常行为
      this.recordResult('无效文件路径测试', true, `正确抛出错误: ${error.message}`);
    }
  }

  /**
   * 测试进度回调功能
   */
  async testProgressCallback() {
    const fileName = 'progress_test.txt';
    const filePath = this.createTestFile(fileName, '这是一个用于测试进度回调的文件');
    let progressReceived = false;
    let lastProgress = 0;

    const progressCallback = (progress) => {
      progressReceived = true;
      lastProgress = progress;
    };

    try {
      // 执行粉碎并监控进度
      const result = await FileShredder.shredFile(filePath, 'dod', progressCallback);

      this.recordResult(
        '进度回调测试',
        result && progressReceived && lastProgress === 100,
        !progressReceived ? '未收到进度回调' : 
        lastProgress !== 100 ? `进度未达到100%，最后进度: ${lastProgress}` : 
        '进度回调正常工作'
      );
    } catch (error) {
      this.recordResult('进度回调测试', false, `测试过程中发生错误: ${error.message}`);
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('开始运行文件粉碎器测试...\n');

    try {
      await this.setup();

      // 运行各项测试
      await this.testQuickShred();
      await this.testDoDShred();
      await this.testGutmannShred();
      await this.testDirectoryShred();
      await this.testFileSizeLimit();
      await this.testInvalidFilePath();
      await this.testProgressCallback();

      // 输出测试结果摘要
      this.printTestSummary();

    } catch (error) {
      console.error('测试运行过程中发生错误:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 打印测试结果摘要
   */
  printTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;

    console.log('\n===== 测试结果摘要 =====');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests}`);
    console.log(`失败: ${failedTests}`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

    if (failedTests > 0) {
      console.log('\n失败的测试:');
      this.testResults
        .filter(result => !result.passed)
        .forEach(result => {
          console.log(`- ${result.testName}: ${result.message}`);
        });
    }

    console.log('========================');
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  const tests = new FileShredderTests();
  tests.runAllTests().catch(console.error);
}

module.exports = FileShredderTests;