# Merci Player

**A focused, modern desktop media player for Windows.** Built with Electron, React, TypeScript, and Vite.

Merci Player is designed around a clean library, a distraction-free playback stage, and quick access to your queue. It supports local audio and video files, drag-and-drop importing, favorites, playback speed, volume, seeking, and fullscreen.

## Features

- Minimal dark interface with a restrained lime accent
- Local file picker and drag-and-drop import
- Audio and video playback using the Chromium media engine
- Queue, library, favorites, and search
- Play/pause, previous/next, seek, volume, mute, repeat, and shuffle controls
- Playback speed control
- Fullscreen video
- Keyboard shortcuts
- Windows installer and portable executable builds

## Supported file extensions

The file picker recognizes MP4, MKV, AVI, MOV, WebM, M4V, MP3, WAV, FLAC, AAC, OGG, M4A, and WMA. Actual playback depends on the codecs available in the Electron/Windows media engine. VLC-level codec coverage (including some MKV/AVI variants) requires a dedicated bundled FFmpeg or libVLC playback backend and is a planned upgrade.

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

## Build the Windows app

```bash
npm run dist:win
```

The `release/` directory contains:
- `Merci Player-1.0.0-x64.exe` — Windows installer
- `Merci Player-1.0.0-x64.exe` — portable target (electron-builder names may be differentiated by target metadata)

For a directory build without an installer:

```bash
npm run dist:dir
```

## Automated Windows build

GitHub Actions builds the Windows installer and portable executable on pushes to `main` that touch app/build files. Open the repository's **Actions** tab and download the `Merci-Player-Windows` artifact from a successful run. You can also start a build manually with **Run workflow**.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl + O | Open media files |
| Space | Play / pause |
| Left / Right | Seek backward / forward 5 seconds |
| Up / Down | Increase / decrease volume |
| F | Fullscreen |

## Project structure

```
electron/       Electron main process and secure preload bridge
src/            React application and styles
.github/        Windows build workflow
```

## Security

The renderer runs with Node integration disabled and context isolation enabled. File selection and window actions are exposed through a small preload bridge.
