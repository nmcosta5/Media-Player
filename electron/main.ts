import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { pathToFileURL } from "node:url";
import { readdir, readFile, stat } from "node:fs/promises";
import { parseFile } from "music-metadata";
import path from "node:path";

const isDev = !app.isPackaged;
app.setName("Merci Player");
if (process.platform === "win32") app.setAppUserModelId("com.merciplayer.desktop");
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 760, minHeight: 560,
    backgroundColor: "#08090a", title: "Merci Player",
    icon: path.join(__dirname, "../build/icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    },
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#17191b", symbolColor: "#c6c8ca", height: 42 }
  });
  if (isDev) mainWindow.loadURL("http://127.0.0.1:5173");
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

const mediaExtensions = new Set(["mp4","mkv","avi","mov","webm","m4v","mp3","wav","flac","aac","ogg","m4a","wma","png","jpg","jpeg","gif","webp","bmp","avif","svg","svg"]);
const supportedMedia = (filePath: string) => mediaExtensions.has(path.extname(filePath).slice(1).toLowerCase());
const asMediaFile = (filePath: string) => ({ name: path.basename(filePath), path: filePath, url: pathToFileURL(filePath).href });

async function scanDirectory(root: string) {
  const found: ReturnType<typeof asMediaFile>[] = [];
  const pending = [root];
  const maxFiles = 12000;
  while (pending.length && found.length < maxFiles) {
    const current = pending.pop()!;
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "$RECYCLE.BIN") pending.push(fullPath);
      } else if (entry.isFile() && supportedMedia(fullPath)) {
        found.push(asMediaFile(fullPath));
        if (found.length >= maxFiles) break;
      }
    }
  }
  return found;
}

async function chooseMedia(multiple = true) {
  const result = await dialog.showOpenDialog({
    title: "Open media",
    properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: [
      { name: "Supported media", extensions: [
        "mp4","mkv","avi","mov","webm","m4v","mpg","mpeg","wmv","ts",
        "mp3","wav","flac","aac","ogg","m4a","wma","aiff","opus",
        "png","jpg","jpeg","gif","webp","bmp","avif","svg"
      ] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled) return [];
  return result.filePaths.map(asMediaFile);
}

app.whenReady().then(() => {
  ipcMain.handle("media:open", () => chooseMedia(true));
  ipcMain.handle("media:metadata", async (_event, filePath: string) => {
    try {
      const metadata = await parseFile(filePath);
      const picture = metadata.common.picture?.[0];
      return {
        title: metadata.common.title ?? null,
        artist: metadata.common.artist ?? metadata.common.artists?.join(", ") ?? null,
        album: metadata.common.album ?? null,
        year: metadata.common.year ?? null,
        artwork: picture ? `data:${picture.format};base64,${Buffer.from(picture.data).toString("base64")}` : null,
        duration: metadata.format.duration ?? null,
        bitrate: metadata.format.bitrate ?? null
      };
    } catch { return null; }
  });
  ipcMain.handle("media:open-one", () => chooseMedia(false));
  ipcMain.handle("media:open-folder", async () => {
    const result = await dialog.showOpenDialog({ title: "Scan media folder", properties: ["openDirectory"] });
    return result.canceled ? [] : scanDirectory(result.filePaths[0]);
  });
  ipcMain.handle("media:restore-files", async (_event, paths: unknown) => {
    if (!Array.isArray(paths)) return [];
    const safePaths = paths.filter((value): value is string => typeof value === "string" && value.length < 4096).slice(0, 100);
    const restored: ReturnType<typeof asMediaFile>[] = [];
    for (const filePath of safePaths) {
      try { if (supportedMedia(filePath) && (await stat(filePath)).isFile()) restored.push(asMediaFile(filePath)); } catch { /* Skip unavailable files. */ }
    }
    return restored;
  });
  ipcMain.handle("media:find-subtitle", async (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || filePath.length > 4096) return null;
    const directory = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath)).toLowerCase();
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      const match = entries.find(entry => {
        if (!entry.isFile() || ![".srt", ".vtt"].includes(path.extname(entry.name).toLowerCase())) return false;
        const candidate = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
        return candidate === base || candidate.startsWith(base + ".");
      });
      if (!match) return null;
      const subtitlePath = path.join(directory, match.name);
      return { name: match.name, content: await readFile(subtitlePath, "utf8"), path: subtitlePath };
    } catch { return null; }
  });
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());
  const template: Electron.MenuItemConstructorOptions[] = [
    { label: "File", submenu: [
      { label: "Open file…", accelerator: "CmdOrCtrl+O", click: () => mainWindow?.webContents.send("menu:open") },
      { label: "Open multiple files…", accelerator: "CmdOrCtrl+Shift+O", click: () => mainWindow?.webContents.send("menu:open-multiple") },
      { type: "separator" }, { role: "quit" }
    ]},
    { label: "Playback", submenu: [
      { label: "Play / Pause", accelerator: "Space", click: () => mainWindow?.webContents.send("menu:play-pause") },
      { label: "Stop", accelerator: "S", click: () => mainWindow?.webContents.send("menu:stop") },
      { label: "Fullscreen", accelerator: "F", click: () => mainWindow?.webContents.send("menu:fullscreen") }
    ]},
    { label: "Help", submenu: [
      { label: "About Merci Player", click: () => dialog.showMessageBox({ title: "Merci Player", message: "Merci Player", detail: "A focused, modern media experience. Version " + app.getVersion(), buttons: ["Close"] }) }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });