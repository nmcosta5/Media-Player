import { contextBridge, ipcRenderer } from "electron";

type MediaFile = { name: string; path: string; url: string };

contextBridge.exposeInMainWorld("merci", {
  openFiles: (): Promise<MediaFile[]> => ipcRenderer.invoke("media:open"),
  getMetadata: (filePath: string): Promise<{title:string|null;artist:string|null;album:string|null;year:number|null;artwork:string|null;duration:number|null;bitrate:number|null}|null> => ipcRenderer.invoke("media:metadata", filePath),
  openOne: (): Promise<MediaFile[]> => ipcRenderer.invoke("media:open-one"),
  openFolder: (): Promise<string[]> => ipcRenderer.invoke("media:open-folder"),
  minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
  maximize: (): Promise<boolean> => ipcRenderer.invoke("window:maximize"),
  close: (): Promise<void> => ipcRenderer.invoke("window:close"),
  onMenu: (callback: (action: string) => void) => {
    const listeners = new Map<string, (_event: Electron.IpcRendererEvent) => void>();
    for (const action of ["open", "open-multiple", "play-pause", "stop", "fullscreen"]) {
      const listener = () => callback(action);
      listeners.set(action, listener);
      ipcRenderer.on("menu:" + action, listener);
    }
    return () => {
      for (const [action, listener] of listeners) {
        ipcRenderer.removeListener("menu:" + action, listener);
      }
    };
  }
});