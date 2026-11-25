/// <reference types="vite/client" />

type MediaFile = { name: string; path: string; url: string };

declare global {
  interface Window {
    merci?: {
      openFiles: () => Promise<MediaFile[]>;
      getMetadata: (filePath: string) => Promise<{title:string|null;artist:string|null;album:string|null;year:number|null;artwork:string|null;duration:number|null;bitrate:number|null}|null>;
      openOne: () => Promise<MediaFile[]>;
      openFolder: () => Promise<string[]>;
      minimize: () => Promise<void>;
      maximize: () => Promise<boolean>;
      close: () => Promise<void>;
      onMenu: (callback: (action: string) => void) => () => void;
    };
  }
}

export {};