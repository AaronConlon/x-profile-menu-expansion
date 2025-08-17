# X/Twitter Profile Links Extension

[English](./README.md) | **中文**

## 简介

X/Twitter Profile Links Extension 是一个 Chrome 浏览器扩展，旨在为 X.com（原 Twitter）上的用户资料链接添加悬停菜单和模态弹出功能。用户可以通过右键点击快速查看用户的不同内容部分，如帖子、回复、媒体等。

## 功能

- **悬停菜单**：在用户资料链接上悬停时显示菜单。
- **模态弹出**：右键点击菜单项以模态形式查看内容。
- **尺寸调整**：支持拖拽调整模态框大小，并自动保存尺寸。
- **媒体控制**：打开模态框时自动暂停页面上的视频和音频。
- **调试按钮**：提供调试按钮以便开发者测试模态功能。

## 安装

1. 克隆或下载此仓库。
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`。
3. 打开右上角的“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择项目文件夹。

## 使用说明

- **悬停菜单**：将鼠标悬停在 X.com 上的用户资料链接上以显示菜单。
- **模态弹出**：右键点击菜单项以打开模态框查看内容。
- **调试按钮**：在页面右下角显示的调试按钮可用于测试模态功能。

## 开发者信息

- **文件结构**：
  - `manifest.json`：Chrome 扩展的配置文件。
  - `content.js`：主要的 JavaScript 逻辑文件。
  - `styles.css`：扩展的样式文件。

- **开发指南**：
  - 使用 `chrome.storage.local` 存储和加载模态框尺寸。
  - 通过 `window.__xProfileExtensionModalCreated` 变量跟踪模态框创建状态。
  - 使用 `window.addEventListener('message', ...)` 处理 iframe 通信。

## 贡献

欢迎贡献代码！请提交 Pull Request 或报告问题。

## 许可证

MIT 许可证。详见 LICENSE 文件。
