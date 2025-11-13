const icongen = require('icon-gen');
const path = require('path');

async function convertSvgToIco() {
  try {
    const svgPath = path.join(__dirname, '../assets/icon.svg');
    const icoPath = path.join(__dirname, '../build');
    
    // 使用icon-gen将SVG转换为ICO
    const files = await icongen(svgPath, icoPath, {
      // Windows图标设置
      ico: {
        name: 'icon',
        sizes: [256, 128, 64, 48, 32, 16]
      },
      // 可选：同时生成其他格式
      // icns: {
      //   name: 'icon',
      //   sizes: [256, 128, 64, 48, 32, 16]
      // },
      // favicon: {
      //   name: 'favicon',
      //   sizes: [256, 128, 64, 48, 32, 16]
      // }
    });
    
    console.log('图标转换成功:', files);
  } catch (error) {
    console.error('图标转换失败:', error);
  }
}

convertSvgToIco();