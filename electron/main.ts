import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { pathToFileURL } from "node:url";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { parseFile } from "music-metadata";
import path from "node:path";

const isDev = !app.isPackaged;
app.setName("Merci Player");
if (process.platform === "win32") app.setAppUserModelId("com.merciplayer.desktop");
let mainWindow: BrowserWindow | null = null;
let pendingOpenFiles: ReturnType<typeof asMediaFile>[] = [];
let rendererReady = false;
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) app.quit();


function createWindow() {
  rendererReady = false;
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

const mediaExtensions = new Set(["mp4","mkv","avi","mov","webm","m4v","mpg","mpeg","wmv","ts","mp3","wav","flac","aac","ogg","m4a","wma","aiff","opus","png","jpg","jpeg","gif","webp","bmp","avif","svg"]);
const supportedMedia = (filePath: string) => mediaExtensions.has(path.extname(filePath).slice(1).toLowerCase());
const asMediaFile = (filePath: string) => ({ name: path.basename(filePath), path: filePath, url: pathToFileURL(filePath).href });
async function filesFromLaunchArgs(args: string[]) {
  const found: ReturnType<typeof asMediaFile>[] = [];
  for (const value of args) {
    if (!value || value.startsWith("-") || !supportedMedia(value)) continue;
    try {
      const candidate = path.resolve(value);
      if ((await stat(candidate)).isFile()) found.push(asMediaFile(candidate));
    } catch { /* Ignore switches, installer paths and files that no longer exist. */ }
  }
  return found;
}
function deliverPendingOpenFiles() {
  if (!rendererReady || !mainWindow || mainWindow.webContents.isLoadingMainFrame() || !pendingOpenFiles.length) return;
  const files = pendingOpenFiles.splice(0);
  mainWindow.webContents.send("media:open-args", files);
}
function queueOpenFiles(files: ReturnType<typeof asMediaFile>[]) {
  if (!files.length) return;
  pendingOpenFiles.push(...files);
  if (mainWindow && !mainWindow.webContents.isLoadingMainFrame()) deliverPendingOpenFiles();
}
if (singleInstanceLock) {
  app.on("second-instance", async (_event, commandLine) => {
    const files = await filesFromLaunchArgs(commandLine.slice(1));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    queueOpenFiles(files);
  });
}


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

type LyricsRecord = {
  id?: number; trackName?: string; name?: string; artistName?: string; albumName?: string;
  duration?: number; instrumental?: boolean; plainLyrics?: string | null; syncedLyrics?: string | null;
};
const lyricsDirectory = () => path.join(app.getPath("documents"), "MerciPlayer", "Lyrics");
const safeLyricsName = (value: string) => value.normalize("NFKC").replace(/[<>:"\\|?*\x00-\x1f]/g, "_").replace(/\//g, "_").replace(/[. ]+$/g, "").trim().slice(0, 90) || "Unknown";
const lyricsHeaders = { "User-Agent": "MerciPlayer/1.0 (https://github.com/nmcosta5/Media-Player)", "Lrclib-Client": "Merci Player/1.0 (https://github.com/nmcosta5/Media-Player)", "Lrclib-App-Id": "Kr9q8mN_4Whs-GIFOis7imxakHza-9Iba1nAkA1hFbc", "Accept": "application/json" };
let lyricsRequestTail: Promise<void> = Promise.resolve();
let lyricsLastRequestAt = 0;
let lyricsRetryAt = 0;

async function getLyricsForTrack(input: { title: string; artist?: string; album?: string; duration?: number }) {
  const title = input.title.trim().slice(0, 240);
  const artist = (input.artist ?? "").trim().slice(0, 240);
  const album = (input.album ?? "").trim().slice(0, 240);
  const duration = Number.isFinite(input.duration) && Number(input.duration) >= 1 && Number(input.duration) <= 3600 ? Math.round(Number(input.duration)) : undefined;
  if (!title) return { status: "invalid", message: "Track title is missing." };
  const directory = lyricsDirectory();
  const baseName = safeLyricsName((artist ? artist + " - " : "") + title + (album ? " - " + album : ""));
  const localSynced = path.join(directory, baseName + ".lrc");
  const localPlain = path.join(directory, baseName + ".txt");
  try {
    const [syncedLyrics, plainLyrics] = await Promise.all([
      readFile(localSynced, "utf8").catch(() => null),
      readFile(localPlain, "utf8").catch(() => null)
    ]);
    if (syncedLyrics || plainLyrics) return { status: "cached", trackName: title, artistName: artist, albumName: album, syncedLyrics, plainLyrics, savedPath: directory, source: "Local lyrics cache" };
  } catch { /* A missing Documents folder is created after a successful download. */ }
  const request = async (url: URL): Promise<{response: Response; data: unknown}> => {
    const task = lyricsRequestTail.then(async () => {
      const retryWait = Math.max(0, lyricsRetryAt - Date.now());
      if (retryWait > 0) throw Object.assign(new Error("LRCLIB rate limit cooldown is active. Try again in " + Math.ceil(retryWait / 1000) + " seconds."), { retryAfter: Math.ceil(retryWait / 1000) });
      const delay = Math.max(0, 350 - (Date.now() - lyricsLastRequestAt));
      if (delay > 0) await new Promise<void>(resolve => setTimeout(resolve, delay));
      lyricsLastRequestAt = Date.now();
      const fetchOptions = { signal: AbortSignal.timeout(15000) };
      let requestHeaders: Record<string, string> = { ...lyricsHeaders };
      let response = await fetch(url, { ...fetchOptions, headers: requestHeaders });
      // A stale or revoked public App ID must not disable anonymous LRCLIB access.
      if (response.status === 401 && "Lrclib-App-Id" in requestHeaders) {
        const fallbackHeaders = { ...requestHeaders };
        delete fallbackHeaders["Lrclib-App-Id"];
        requestHeaders = fallbackHeaders;
        response = await fetch(url, { ...fetchOptions, headers: requestHeaders });
      }
      if (response.status === 429) {
        const rawRetry = response.headers.get("retry-after") || "30";
        const numericRetry = Number(rawRetry);
        const parsedRetry = Number.isFinite(numericRetry) ? numericRetry : (Date.parse(rawRetry) - Date.now()) / 1000;
        const retryAfter = Number.isFinite(parsedRetry) ? Math.max(1, parsedRetry) : 30;
        lyricsRetryAt = Date.now() + retryAfter * 1000 + Math.random() * retryAfter * 300;
        throw Object.assign(new Error("LRCLIB rate limit reached. The app will respect its Retry-After window."), { retryAfter: Math.ceil(retryAfter) });
      }
      // LRCLIB can temporarily return 503 during maintenance or load spikes.
      // Retry once when the server supplies a short Retry-After value.
      if (response.status === 503) {
        const rawRetry = response.headers.get("retry-after") || "1";
        const numericRetry = Number(rawRetry);
        const parsedRetry = Number.isFinite(numericRetry) ? numericRetry : (Date.parse(rawRetry) - Date.now()) / 1000;
        const retryAfter = Number.isFinite(parsedRetry) ? Math.max(1, parsedRetry) : 1;
        if (retryAfter <= 4) {
          await new Promise<void>(resolve => setTimeout(resolve, retryAfter * 1000 + Math.random() * retryAfter * 300));
          response = await fetch(url, { ...fetchOptions, headers: requestHeaders });
        }
      }
      if (!response.ok && response.status !== 404) {
        if (response.status >= 500) return { response, data: null };
        throw new Error("LRCLIB returned HTTP " + response.status);
      }
      const contentType = response.headers.get("content-type") || "";
      const data = response.ok && contentType.includes("application/json") ? await response.json() as unknown : null;
      return { response, data };
    });
    lyricsRequestTail = task.then(() => undefined, () => undefined);
    return task;
  };
  let record: LyricsRecord | null = null;
  try {
    if (artist) {
      const signature = new URL("https://lrclib.net/api/get");
      signature.searchParams.set("track_name", title);
      signature.searchParams.set("artist_name", artist);
      if (album) signature.searchParams.set("album_name", album);
      if (duration) signature.searchParams.set("duration", String(duration));
      const exact = await request(signature);
      if (exact.response.ok && exact.data && typeof exact.data === "object") record = exact.data as LyricsRecord;
    }
    const hasUsableLyrics = (candidate: LyricsRecord | null) => !!candidate && !candidate.instrumental && (
      (typeof candidate.syncedLyrics === "string" && candidate.syncedLyrics.trim().length > 0) ||
      (typeof candidate.plainLyrics === "string" && candidate.plainLyrics.trim().length > 0)
    );
    if (!hasUsableLyrics(record)) {
      const search = new URL("https://lrclib.net/api/search");
      if (artist) { search.searchParams.set("track_name", title); search.searchParams.set("artist_name", artist); }
      else search.searchParams.set("q", title);
      if (album) search.searchParams.set("album_name", album);
      const result = await request(search);
      if (!result.response.ok && result.response.status >= 500) return { status: "error", message: "LRCLIB is temporarily unavailable. Please try again shortly." };
      const candidates = Array.isArray(result.data) ? result.data as LyricsRecord[] : [];
      const normalise = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^\\p{L}\\p{N}]+/gu, " ").trim();
      const wantedTitle = normalise(title); const wantedArtist = normalise(artist); const wantedAlbum = normalise(album);
      const ranked = candidates.map(candidate => {
        const candidateTitle = normalise(candidate.trackName ?? candidate.name ?? "");
        const candidateArtist = normalise(candidate.artistName ?? "");
        const candidateAlbum = normalise(candidate.albumName ?? "");
        let score = candidateTitle === wantedTitle ? 8 : candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle) ? 3 : 0;
        if (wantedArtist && candidateArtist) score += candidateArtist === wantedArtist ? 5 : candidateArtist.includes(wantedArtist) || wantedArtist.includes(candidateArtist) ? 2 : -2;
        if (wantedAlbum && candidateAlbum) score += candidateAlbum === wantedAlbum ? 2 : 0;
        if (duration && typeof candidate.duration === "number") score += Math.abs(candidate.duration - duration) <= 2 ? 3 : Math.abs(candidate.duration - duration) <= 8 ? 1 : -2;
        return { candidate, score };
      }).filter(value => value.score >= (wantedArtist ? 8 : 5)).sort((a, b) => b.score - a.score);
      record = ranked.find(value => hasUsableLyrics(value.candidate))?.candidate ?? ranked[0]?.candidate ?? record;
    }
    if (!record) return { status: "not-found", message: "No matching lyrics were found on LRCLIB." };
    const syncedLyrics = typeof record.syncedLyrics === "string" && record.syncedLyrics.trim() ? record.syncedLyrics : null;
    const plainLyrics = typeof record.plainLyrics === "string" && record.plainLyrics.trim() ? record.plainLyrics : null;
    if (record.instrumental || (!syncedLyrics && !plainLyrics)) return { status: "instrumental", trackName: record.trackName ?? title, artistName: record.artistName ?? artist, message: "LRCLIB marks this track as instrumental or has no lyrics text." };
    await mkdir(directory, { recursive: true });
    if (syncedLyrics) await writeFile(localSynced, syncedLyrics + "\n", "utf8");
    if (plainLyrics) await writeFile(localPlain, plainLyrics + "\n", "utf8");
    return { status: "found", id: record.id ?? null, trackName: record.trackName ?? record.name ?? title, artistName: record.artistName ?? artist, albumName: record.albumName ?? album, duration: record.duration ?? duration ?? null, syncedLyrics, plainLyrics, savedPath: directory, source: "LRCLIB" };
  } catch (error) {
    const failure = error as Error & { retryAfter?: number };
    return { status: "error", message: failure.message || "Could not reach LRCLIB.", retryAfter: failure.retryAfter ?? null };
  }
}
app.whenReady().then(async () => {
  if (!singleInstanceLock) return;
  ipcMain.on("renderer:ready", () => { rendererReady = true; deliverPendingOpenFiles(); });
  pendingOpenFiles = [...pendingOpenFiles, ...await filesFromLaunchArgs(process.argv.slice(1))];
  ipcMain.handle("media:open", () => chooseMedia(true));
  ipcMain.handle("lyrics:get", async (_event, input: unknown) => {
    if (!input || typeof input !== "object") return { status: "invalid", message: "Invalid lyrics request." };
    const value = input as Record<string, unknown>;
    if (typeof value.title !== "string" || value.title.length > 240 || (value.artist !== undefined && typeof value.artist !== "string") || (value.album !== undefined && typeof value.album !== "string")) return { status: "invalid", message: "Invalid track information." };
    return getLyricsForTrack({ title: value.title, artist: typeof value.artist === "string" ? value.artist : undefined, album: typeof value.album === "string" ? value.album : undefined, duration: typeof value.duration === "number" ? value.duration : undefined });
  });
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
    const result = await dialog.showOpenDialog({ title: "Open media folder", properties: ["openDirectory"] });
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
  ipcMain.handle("media:save-snapshot", async (_event, dataUrl: unknown, suggestedName: unknown) => {
    if (typeof dataUrl !== "string" || dataUrl.length > 32_000_000) throw new Error("Snapshot image is too large or invalid.");
    const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Only PNG and JPEG snapshots are supported.");
    const extension = match[1] === "jpeg" ? "jpg" : "png";
    const baseName = typeof suggestedName === "string" ? path.basename(suggestedName).replace(/[^a-z0-9._-]/gi, "_").slice(0, 80) : "Merci-Player-Snapshot";
    const result = await dialog.showSaveDialog({
      title: "Save video snapshot",
      defaultPath: path.join(app.getPath("pictures"), (path.parse(baseName).name || "Merci-Player-Snapshot") + "." + extension),
      filters: [{ name: extension.toUpperCase() + " image", extensions: [extension] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await writeFile(result.filePath, Buffer.from(match[2], "base64"));
    return { canceled: false, filePath: result.filePath };
  });
  ipcMain.handle("window:open-default-apps", async () => { if (process.platform === "win32") await shell.openExternal("ms-settings:defaultapps"); else await shell.openPath(app.getPath("home")); return true; });
  ipcMain.handle("window:always-on-top", (_event, enabled: unknown) => {
    if (!mainWindow) return false;
    const value = enabled === true;
    mainWindow.setAlwaysOnTop(value);
    return mainWindow.isAlwaysOnTop();
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
      { label: "Open folder…", accelerator: "CmdOrCtrl+Shift+O", click: () => mainWindow?.webContents.send("menu:open-folder") },
      { label: "Open multiple files…", accelerator: "CmdOrCtrl+Alt+O", click: () => mainWindow?.webContents.send("menu:open-multiple") },
      { type: "separator" }, { role: "quit" }
    ]},
    { label: "Playback", submenu: [
      { label: "Play / Pause", click: () => mainWindow?.webContents.send("menu:play-pause") },
      { label: "Stop", click: () => mainWindow?.webContents.send("menu:stop") },
      { label: "Fullscreen", click: () => mainWindow?.webContents.send("menu:fullscreen") }
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