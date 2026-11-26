# Merci Player

**A focused, VLC-inspired desktop media player for Windows.** Built with Electron, React, TypeScript, and Vite.

Merci Player combines a player-first workspace with local media discovery, a persistent playback queue, saved playlists, subtitle tools, and advanced audio/video controls. Its visual system uses graphite surfaces, soft neutral text, and a warm orange accent.

## Features

### Playback and library
- Local audio, video, and image playback with drag-and-drop importing.
- Recursive folder scanning for supported local media, with a 12,000-file safety cap.
- Library search, media-type filters, and sorting by added order, recent playback, or name.
- Recently played files, favorites, and automatic resume from the last saved position for desktop file paths.
- Persistent queue and saved playlists, including queue reordering and playlist playback.
- Embedded audio metadata and artwork; video-frame thumbnails when a frame can be captured.
- Windows Media Session metadata and transport actions where the platform supports them.

### Player controls
- VLC-inspired transport controls, keyboard shortcuts, and a smoother draggable seek bar.
- Played and buffered progress, hover time preview, and responsive playhead updates.
- 10-second skip controls, playback speed, repeat, shuffle, and A–B looping.
- Frame stepping for video, aspect-ratio selection, and fullscreen controls that hide after inactivity.
- Fullscreen video uses the full viewport with transport and track information overlaid on top of the picture; previous, play/pause, next, volume, and captions remain accessible.
- Picture-in-Picture, always-on-top window mode, and video snapshot saving.
- Per-media bookmarks and a sleep timer.

### Audio and video tools
- 10-band equalizer with presets and live spectrum visualization.
- Audio-output device selection when the desktop media engine exposes device switching.
- Video brightness, contrast, saturation, and rotation controls.
- Media information panel for track, file, duration, and available video details.

### Music lyrics
- Automatic LRCLIB lookup for the currently playing audio track, using embedded title, artist, album, and duration metadata where available.
- Displays synchronized LRC lyrics with a live highlighted line, with plain lyrics as a fallback.
- Automatically saves downloaded `.lrc` and `.txt` files under `Documents/MerciPlayer/Lyrics` and reuses the local cache when offline.
- Lyrics open in an edge-to-edge, Spotify-inspired view with album-art ambience, smooth active-line scrolling, and integrated playback controls.
- Manually adjust lyric timing in 0.1-second or 0.5-second steps; each track's offset is saved and restored automatically.
- Lookup retries automatically when the internet connection returns; downloaded lyrics remain available from the local cache.
- Lyrics can be opened from the top **Lyrics** menu; press `L` to show or hide the lyrics view while audio is active.

### Subtitles
- Manual SRT and VTT subtitle loading.
- Automatic sidecar subtitle discovery beside local video files.
- Subtitle delay/synchronization, font family, font size, text color, and background opacity controls.

## Supported file extensions

Downloaded LRCLIB lyrics are stored locally at `%USERPROFILE%\\Documents\\MerciPlayer\\Lyrics` on Windows. LRCLIB is an online service; an existing local lyrics file is loaded without requiring an internet connection.

The current file picker and folder scanner recognize:

- **Audio:** MP3, WAV, FLAC, AAC, OGG, M4A, WMA, AIFF, OPUS
- **Video:** MP4, MKV, AVI, MOV, WebM, M4V, MPG, MPEG, WMV, TS
- **Images:** PNG, JPG, JPEG, GIF, WebP, BMP, AVIF, SVG
- **External subtitles:** SRT and VTT

Actual audio/video playback depends on codecs supported by the Electron/Chromium media engine on the target Windows installation. This is not a bundled libVLC engine, so format recognition does not guarantee that every codec/container combination will decode.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Space | Play / pause |
| N / P | Next / previous media |
| M | Mute / unmute |
| A | Cycle aspect ratio |
| F | Fullscreen |
| S | Stop |
| V | Toggle subtitles |
| L | Toggle music lyrics |
| R | Set A–B loop points / clear loop |
| E | Pause / advance video one frame |
| [ / ] | Decrease / increase playback speed |
| = | Reset playback speed to 1× |
| Left / Right | Seek 5 seconds |
| Shift + Left / Right | Seek 10 seconds |
| Ctrl + Left / Right | Seek 60 seconds |
| Up / Down | Adjust volume |
| T | Toggle queue |
| I | Show media information |
| Ctrl + B | Add/remove bookmark at current position |
| Ctrl + Shift + S | Save video snapshot |
| Ctrl + O | Open file |
| Ctrl + Shift + O | Open folder / scan |
| Ctrl + Alt + O | Open multiple files |
| Ctrl + L | Open media library |
| Ctrl + Shift + P | Create playlist |
| ? | Show keyboard shortcut reference |

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
- `Merci Player-1.0.0-Setup-x64.exe` — Windows installer
- `Merci Player-1.0.0-Portable-x64.exe` — portable executable

For a directory build without an installer:

```bash
npm run dist:dir
```

## Automated Windows build

GitHub Actions builds the Windows installer and portable executable on pushes to configured app/build branches. Open the repository's **Actions** tab and download the `Merci-Player-Windows` artifact from a successful run. You can also start a build manually with **Run workflow**.

## Project structure

```
electron/       Electron main process and secure preload bridge
src/            React application and styles
.github/        Windows build workflow
```

## Security

The renderer runs with Node integration disabled and context isolation enabled. File selection, folder scanning, metadata, snapshot saving, and window actions are exposed through a constrained preload bridge.
