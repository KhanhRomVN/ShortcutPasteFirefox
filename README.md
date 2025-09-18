# ShortcutPaste - Clipboard Manager Extension

ShortcutPaste is a powerful Chrome extension that helps you manage and quickly paste your clipboard items with keyboard shortcuts.

## Features

- 📋 **Clipboard History**: Store and manage multiple clipboard items
- ⭐ **Favorite Items**: Mark items as favorites for quick access
- 🗂️ **Folder Organization**: Organize items into folders and subfolders
- ⌨️ **Keyboard Shortcuts**: Paste favorite items with `Alt+Shift+V`
- 🔍 **Search & Filter**: Quickly find items by content or type
- 🖼️ **Multiple Content Types**: Support for text, HTML, URLs, and images
- 💾 **Storage Management**: Monitor storage usage with visual indicators
- 📱 **Responsive UI**: Clean, modern interface with dark/light theme support

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon will appear in your toolbar

## Usage

### Basic Usage

1. Click the extension icon to open the popup
2. View your clipboard history in the left sidebar
3. Click any item to view its content in the main panel
4. Use the buttons to copy, edit, or delete items

### Keyboard Shortcut

- Press `Alt+Shift+V` (Windows/Linux) or `MacCtrl+Shift+V` (Mac) to paste your favorite clipboard item into any active text field

### Managing Items

- **Create Items**: Click "Create Item" or use context menus
- **Organize**: Create folders and subfolders to organize items
- **Favorites**: Mark items as favorites (only one favorite allowed at a time)
- **Search**: Use the search bar to find specific items
- **Filter**: Filter by content type (text, HTML, URL, image) or favorites

## Development

### Project Structure

```
src/
├── background/          # Service worker and background scripts
├── content-scripts/    # Content scripts for page interaction
├── presentation/       # React components for UI
├── shared/             # Shared utilities and types
└── types/              # TypeScript type definitions
```

### Building

```bash
npm install
npm run build
```

### Development

```bash
npm run dev
```

## Technical Details

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Storage**: Chrome Storage API (local and sync)
- **Content Scripts**: Injected for page interaction
- **Manifest**: Chrome Extension Manifest V3

## Support

For issues or questions:

- Email: khanhromvn@gmail.com
- GitHub: [KhanhRomVN/ShortcutPaste](https://github.com/KhanhRomVN/ShortcutPaste)

## License

This project is proprietary software. All rights reserved.
