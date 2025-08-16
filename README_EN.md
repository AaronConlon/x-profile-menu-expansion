# X/Twitter Profile Links Extension

## Introduction

The X/Twitter Profile Links Extension is a Chrome browser extension designed to add a hover menu and modal popup functionality to user profile links on X.com (formerly Twitter). Users can quickly view different content sections such as posts, replies, media, etc., by right-clicking.

## Features

- **Hover Menu**: Displays a menu when hovering over user profile links.
- **Modal Popup**: Right-click a menu item to view content in a modal.
- **Resizable**: Supports drag-and-drop resizing of the modal and automatically saves dimensions.
- **Media Control**: Automatically pauses videos and audio on the page when the modal is opened.
- **Debug Button**: Provides a debug button for developers to test modal functionality.

## Installation

1. Clone or download this repository.
2. Open Chrome browser and go to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click "Load unpacked" and select the project folder.

## Usage

- **Hover Menu**: Hover over user profile links on X.com to display the menu.
- **Modal Popup**: Right-click a menu item to open the modal and view content.
- **Debug Button**: Use the debug button displayed at the bottom right of the page to test modal functionality.

## Developer Information

- **File Structure**:
  - `manifest.json`: Configuration file for the Chrome extension.
  - `content.js`: Main JavaScript logic file.
  - `styles.css`: Stylesheet for the extension.

- **Development Guide**:
  - Uses `chrome.storage.local` to store and load modal dimensions.
  - Tracks modal creation state with `window.__xProfileExtensionModalCreated`.
  - Handles iframe communication using `window.addEventListener('message', ...)`.

## Contribution

Contributions are welcome! Please submit a Pull Request or report issues.

## License

MIT License. See LICENSE file for details.
