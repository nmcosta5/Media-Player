import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { pathToFileURL } from "node:url";
import path from "node:path";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0b0c0e",
    title: "Merci Player",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#101113",
      symbolColor: "#a8a9ad",
      height: 38
    }
  });

  if (isDev) mainWindow.loadURL("http://127.0.0.1:5173");
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

async function chooseMedia(multiple = true) {
  const result = await dialog.showOpenDialog({
    title: "Open media",
    properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: [
      { name: "Media files", extensions: ["mp4", "mkv", "avi", "mov", "webm", "m4v", "mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled) return [];
  return result.filePaths.map((filePath) => ({
    name: path.basename(filePath),
    path: filePath,
    url: pathToFileURL(filePath).href
  }));
}

app.whenReady().then(() => {
  ipcMain.handle("media:open", () => chooseMedia(true));
  ipcMain.handle("media:open-one", () => chooseMedia(false));
  ipcMain.handle("media:open-folder", async () => {
    const result = await dialog.showOpenDialog({ title: "Choose a folder", properties: ["openDirectory"] });
    return result.canceled ? [] : [result.filePaths[0]];
  });
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle("window:close", () => mainWindow?.close());

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: "File", submenu: [
      { label: "Open file…", accelerator: "CmdOrCtrl+O", click: () => mainWindow?.webContents.send("menu:open") },
      { label: "Open multiple files…", accelerator: "CmdOrCtrl+Shift+O", click: () => mainWindow?.webContents.send("menu:open-multiple") },
      { type: "separator" },
      { role: "quit" }
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