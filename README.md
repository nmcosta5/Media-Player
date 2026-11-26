# Merci Player

**A focused, VLC-inspired desktop media player for Windows.** Built with Electron, React, TypeScript, and Vite.

Merci Player combines a player-first workspace with local media discovery, a persistent playback queue, saved playlists, subtitle tools, and advanced audio/video controls. Its visual system uses deep graphite surfaces, system-first typography, a restrained warm accent, and carefully layered translucent controls.

## Features

### Playback and library
- Local audio, video, and image playback with drag-and-drop importing.
- Open folder imports supported local media recursively, with a 12,000-file safety cap.
- Library search, media-type filters, and sorting by added order, recent playback, or name.
- Recently played files, favorites, and automatic resume from the last saved position for desktop file paths.
- Persistent queue and saved playlists, including queue reordering and playlist playback.
- Embedded audio metadata and album artwork, generated cover art for tracks without embedded covers, and real video-frame thumbnails in the media library when a frame can be captured.
- Windows Media Session metadata and transport actions where the platform supports them.

### Player controls
- VLC-inspired audio transport and YouTube-style video controls, with keyboard shortcuts and a precise draggable red seek timeline.
- Video controls stay anchored and visible in the bottom liquid-glass dock during playback and fullscreen, with play/pause, 10-second skip, volume, captions, settings, mini-player, theater mode, and fullscreen.
- A streamlined player workspace removes the crowded toolbar. Open file and Open folder actions remain available in the Media menu, welcome screen, queue, and library; collection search lives in the media library.
- A dedicated **Tracks** shortcut opens the complete playback queue and displays its live item count.
- Played and buffered progress, hover time preview, and responsive playhead updates.
- 10-second skip controls, playback speed, repeat, shuffle, and A–B looping.
- Frame stepping for video, aspect-ratio selection, and fullscreen controls that remain available while watching.
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
- Lyrics open in an edge-to-edge 7clouds-inspired view with an original bundled seven-cloud sunset wallpaper, large white Edo SZ brush lettering, smooth active-line scrolling, and integrated playback controls.
- Edo SZ is bundled locally at `public/fonts/edosz.ttf`, so the lyric typeface does not need a remote font CDN or an internet connection.
- Manually adjust lyric timing in 0.1-second or 0.5-second steps; each track's offset is saved and restored automatically.
- Lookup retries automatically when the internet connection returns; downloaded lyrics remain available from the local cache.
- Open the dedicated Lyrics mode from the player header or the **Lyrics** menu; press `L` to show or hide it while audio is active. Switch between synchronized and plain lyrics, seek by selecting a timed line, and fine-tune each track’s offset.

### Subtitles
- Manual SRT and VTT subtitle loading.
- Automatic sidecar subtitle discovery beside local video files.
- Subtitle delay/synchronization, font family, font size, text color, and background opacity controls.

## Supported file extensions

Downloaded LRCLIB lyrics are stored locally at `%USERPROFILE%\\Documents\\MerciPlayer\\Lyrics` on Windows. LRCLIB is an online service; an existing local lyrics file is loaded without requiring an internet connection.

The current file picker and Open folder action recognize:

- **Audio:** MP3, WAV, FLAC, AAC, OGG, M4A, WMA, AIFF, OPUS
- **Video:** MP4, MKV, AVI, MOV, WebM, M4V, MPG, MPEG, WMV, TS
- **Images:** PNG, JPG, JPEG, GIF, WebP, BMP, AVIF, SVG
- **External subtitles:** SRT and VTT

Actual audio/video playback depends on codecs supported by the Electron/Chromium media engine on the target Windows installation. This is not a bundled libVLC engine, so format recognition does not guarantee that every codec/container combination will decode.


### Visual design and motion
- Apple Human Interface Guidelines-inspired visual direction adapted for a Windows Electron desktop app: content stays central, while glass is reserved for important controls, navigation, and floating panels.
- System-first typography and a local font stack keep the main interface readable and avoid a remote font dependency; the bundled Edo SZ typeface remains dedicated to lyrics.
- Consistent rounded surfaces, measured spacing, clear focus rings, and restrained warm accents unify the player, library, menus, dialogs, queue, equalizer, and lyrics.
- Purposeful motion provides fast feedback for opening panels, switching views, hovering media cards, and revealing artwork without making routine actions wait.
- Respects the operating system's reduced-motion preference and includes a reduced-transparency fallback; core states are not communicated by motion alone.
- Design references: [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), and [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).

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
| Ctrl + Shift + O | Open folder |
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

The renderer runs with Node integration disabled and context isolation enabled. File selection, Open folder, metadata, snapshot saving, and window actions are exposed through a constrained preload bridge. The Windows installer registers supported media extensions for **Open with**; choose Merci Player under Windows Settings → Default apps to make it the default player.
