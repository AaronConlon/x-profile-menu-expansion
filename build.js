#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { createReadStream, createWriteStream } = require('fs');

// Chrome 插件必需的文件列表
const REQUIRED_FILES = [
  'manifest.json',
  'content.js',
  'styles.css',
  'image/x-16.png',
  'image/x-32.png',
  'image/x-64.png',
  'image/x-128.png'
];

// 从 manifest.json 读取版本号
function getVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    return manifest.version;
  } catch (error) {
    console.error('❌ 无法读取 manifest.json:', error.message);
    process.exit(1);
  }
}

// 检查文件是否存在
function checkRequiredFiles() {
  console.log('🔍 检查必需文件...');

  const missingFiles = [];

  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    } else {
      console.log(`  ✅ ${file}`);
    }
  }

  if (missingFiles.length > 0) {
    console.error('❌ 缺少以下必需文件：');
    missingFiles.forEach(file => console.error(`  - ${file}`));
    process.exit(1);
  }

  console.log('✅ 所有必需文件都存在\n');
}

// 简单的 ZIP 实现
class SimpleZip {
  constructor() {
    this.files = [];
    this.centralDirectory = Buffer.alloc(0);
    this.endOfCentralDirectory = Buffer.alloc(0);
  }

  // 添加文件到 ZIP
  addFile(filePath, fileName = null) {
    const actualFileName = fileName || filePath;
    const fileData = fs.readFileSync(filePath);
    const compressedData = zlib.deflateSync(fileData);

    // ZIP 文件头结构
    const localFileHeader = this.createLocalFileHeader(actualFileName, fileData.length, compressedData.length);
    const centralDirectoryHeader = this.createCentralDirectoryHeader(actualFileName, fileData.length, compressedData.length, this.getCurrentOffset());

    this.files.push({
      localFileHeader,
      fileName: actualFileName,
      compressedData,
      centralDirectoryHeader
    });

    console.log(`  ➕ ${actualFileName}`);
  }

  // 创建本地文件头
  createLocalFileHeader(fileName, uncompressedSize, compressedSize) {
    const fileNameBuffer = Buffer.from(fileName, 'utf8');
    const header = Buffer.alloc(30 + fileNameBuffer.length);

    header.writeUInt32LE(0x04034b50, 0); // Local file header signature
    header.writeUInt16LE(20, 4); // Version needed to extract
    header.writeUInt16LE(0, 6); // General purpose bit flag
    header.writeUInt16LE(8, 8); // Compression method (deflate)
    header.writeUInt16LE(0, 10); // File last modification time
    header.writeUInt16LE(0, 12); // File last modification date
    header.writeUInt32LE(this.crc32(fileName), 14); // CRC-32
    header.writeUInt32LE(compressedSize, 18); // Compressed size
    header.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    header.writeUInt16LE(fileNameBuffer.length, 26); // File name length
    header.writeUInt16LE(0, 28); // Extra field length

    fileNameBuffer.copy(header, 30);

    return header;
  }

  // 创建中央目录头
  createCentralDirectoryHeader(fileName, uncompressedSize, compressedSize, localHeaderOffset) {
    const fileNameBuffer = Buffer.from(fileName, 'utf8');
    const header = Buffer.alloc(46 + fileNameBuffer.length);

    header.writeUInt32LE(0x02014b50, 0); // Central directory signature
    header.writeUInt16LE(20, 4); // Version made by
    header.writeUInt16LE(20, 6); // Version needed to extract
    header.writeUInt16LE(0, 8); // General purpose bit flag
    header.writeUInt16LE(8, 10); // Compression method
    header.writeUInt16LE(0, 12); // File last modification time
    header.writeUInt16LE(0, 14); // File last modification date
    header.writeUInt32LE(this.crc32(fileName), 16); // CRC-32
    header.writeUInt32LE(compressedSize, 20); // Compressed size
    header.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    header.writeUInt16LE(fileNameBuffer.length, 28); // File name length
    header.writeUInt16LE(0, 30); // Extra field length
    header.writeUInt16LE(0, 32); // File comment length
    header.writeUInt16LE(0, 34); // Disk number start
    header.writeUInt16LE(0, 36); // Internal file attributes
    header.writeUInt32LE(0, 38); // External file attributes
    header.writeUInt32LE(localHeaderOffset, 42); // Local header offset

    fileNameBuffer.copy(header, 46);

    return header;
  }

  // 获取当前偏移量
  getCurrentOffset() {
    let offset = 0;
    for (const file of this.files) {
      offset += file.localFileHeader.length + file.compressedData.length;
    }
    return offset;
  }

  // 简单的 CRC32 实现
  crc32(str) {
    // 简化版本，实际项目中应使用更完整的实现
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < str.length; i++) {
      crc = crc ^ str.charCodeAt(i);
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & (-(crc & 1)));
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // 创建中央目录结束记录
  createEndOfCentralDirectory(centralDirSize, centralDirOffset) {
    const endRecord = Buffer.alloc(22);

    endRecord.writeUInt32LE(0x06054b50, 0); // End of central directory signature
    endRecord.writeUInt16LE(0, 4); // Number of this disk
    endRecord.writeUInt16LE(0, 6); // Disk where central directory starts
    endRecord.writeUInt16LE(this.files.length, 8); // Number of central directory records on this disk
    endRecord.writeUInt16LE(this.files.length, 10); // Total number of central directory records
    endRecord.writeUInt32LE(centralDirSize, 12); // Size of central directory
    endRecord.writeUInt32LE(centralDirOffset, 16); // Offset of central directory
    endRecord.writeUInt16LE(0, 20); // ZIP file comment length

    return endRecord;
  }

  // 写入 ZIP 文件
  writeToFile(outputPath) {
    const writeStream = createWriteStream(outputPath);

    // 写入所有文件的本地头和数据
    for (const file of this.files) {
      writeStream.write(file.localFileHeader);
      writeStream.write(file.compressedData);
    }

    // 记录中央目录开始位置
    const centralDirOffset = this.getCurrentOffset();

    // 写入中央目录
    let centralDirSize = 0;
    for (const file of this.files) {
      writeStream.write(file.centralDirectoryHeader);
      centralDirSize += file.centralDirectoryHeader.length;
    }

    // 写入中央目录结束记录
    const endRecord = this.createEndOfCentralDirectory(centralDirSize, centralDirOffset);
    writeStream.write(endRecord);

    writeStream.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }
}

// 创建 ZIP 压缩包
async function createZip(version) {
  const outputPath = `x-profile-menu-extension-v${version}.zip`;

  // 如果输出文件已存在，先删除
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`🗑️  删除现有文件：${outputPath}`);
  }

  console.log('📦 开始压缩文件...');

  const zip = new SimpleZip();

  // 添加必需文件到压缩包
  for (const file of REQUIRED_FILES) {
    try {
      zip.addFile(file);
    } catch (error) {
      console.error(`❌ 无法添加文件 ${file}:`, error.message);
      throw error;
    }
  }

  // 写入 ZIP 文件
  await zip.writeToFile(outputPath);

  // 检查输出文件
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ ZIP 压缩包创建成功:`);
    console.log(`   📁 文件名：${outputPath}`);
    console.log(`   📊 大小：${sizeInMB} MB`);
    console.log(`   📦 包含 ${stats.size} 字节\n`);

    return outputPath;
  } else {
    throw new Error('压缩包创建失败');
  }
}

// 验证压缩包
function verifyZip(zipPath) {
  console.log('🔍 验证压缩包...');

  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    if (stats.size > 0) {
      console.log('✅ 压缩包验证通过');
      return true;
    }
  }

  console.error('❌ 压缩包验证失败');
  return false;
}

// 主函数
async function main() {
  console.log('🚀 开始构建 Chrome 扩展程序...\n');

  try {
    // 检查当前工作目录
    if (!fs.existsSync('./manifest.json')) {
      console.error('❌ 请在项目根目录运行此脚本');
      process.exit(1);
    }

    // 获取版本号
    const version = getVersion();
    console.log(`📋 扩展版本：${version}\n`);

    // 检查必需文件
    checkRequiredFiles();

    // 创建压缩包
    const zipPath = await createZip(version);

    // 验证压缩包
    if (verifyZip(zipPath)) {
      console.log('🎉 Chrome 扩展程序构建完成！');
      console.log(`\n📥 安装说明:`);
      console.log(`   1. 打开 Chrome 浏览器`);
      console.log(`   2. 访问 chrome://extensions/`);
      console.log(`   3. 启用"开发者模式"`);
      console.log(`   4. 将 ${zipPath} 拖拽到页面中安装`);
      console.log(`\n或者:`);
      console.log(`   1. 解压 ${zipPath}`);
      console.log(`   2. 点击"加载已解压的扩展程序"`);
      console.log(`   3. 选择解压后的文件夹`);
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 构建失败：', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { createZip, checkRequiredFiles, getVersion };
