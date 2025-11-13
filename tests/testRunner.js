const FileShredderTests = require('./fileShredder.test');

/**
 * 测试运行器
 */
class TestRunner {
  /**
   * 运行所有测试
   */
  static async runAllTests() {
    console.log('文件粉碎器测试套件');
    console.log('====================');
    
    const tests = new FileShredderTests();
    await tests.runAllTests();
  }

  /**
   * 运行特定测试
   * @param {string} testName - 测试名称
   */
  static async runSpecificTest(testName) {
    console.log(`运行特定测试: ${testName}`);
    console.log('====================');
    
    const tests = new FileShredderTests();
    await tests.setup();
    
    try {
      switch (testName) {
        case 'quick':
          await tests.testQuickShred();
          break;
        case 'dod':
          await tests.testDoDShred();
          break;
        case 'gutmann':
          await tests.testGutmannShred();
          break;
        case 'directory':
          await tests.testDirectoryShred();
          break;
        case 'size':
          await tests.testFileSizeLimit();
          break;
        case 'invalid':
          await tests.testInvalidFilePath();
          break;
        case 'progress':
          await tests.testProgressCallback();
          break;
        default:
          console.error(`未知的测试名称: ${testName}`);
          console.log('可用的测试: quick, dod, gutmann, directory, size, invalid, progress');
          return;
      }
      
      tests.printTestSummary();
    } catch (error) {
      console.error('测试运行过程中发生错误:', error);
    } finally {
      await tests.cleanup();
    }
  }
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.length === 0) {
  // 没有参数，运行所有测试
  TestRunner.runAllTests().catch(console.error);
} else if (args.length === 1) {
  // 有一个参数，运行特定测试
  TestRunner.runSpecificTest(args[0]).catch(console.error);
} else {
  console.error('用法:');
  console.error('  node testRunner.js              # 运行所有测试');
  console.error('  node testRunner.js <testName>    # 运行特定测试');
  console.error('');
  console.error('可用的测试:');
  console.error('  quick      - 快速粉碎测试');
  console.error('  dod        - DoD标准粉碎测试');
  console.error('  gutmann    - Gutmann方法粉碎测试');
  console.error('  directory  - 目录粉碎测试');
  console.error('  size       - 文件大小限制测试');
  console.error('  invalid    - 无效文件路径测试');
  console.error('  progress   - 进度回调测试');
}