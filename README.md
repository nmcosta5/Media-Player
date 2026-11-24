# Merci Player

A clean, modern desktop media player for Windows, built with Electron, React, TypeScript, and Vite.

## Development

```bash
npm install
npm run dev
```

## Build for Windows

```bash
npm run build
npm run dist:win
```

The Windows build produces an NSIS installer and a portable executable in `release/`. GitHub Actions also builds these automatically for Windows and uploads them as workflow artifacts.
