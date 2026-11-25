/// <reference types="vite/client" />

type MediaFile = { name: string; path: string; url: string };

declare global {
  interface Window {
    merci?: {
      openFiles: () => Promise<MediaFile[]>;
      getLyrics: (input: {title:string;artist?:string;album?:string;duration?:number}) => Promise<{status:string;trackName?:string;artistName?:string;albumName?:string;duration?:number|null;plainLyrics?:string|null;syncedLyrics?:string|null;savedPath?:string;source?:string;message?:string;retryAfter?:number|null}>;
      getMetadata: (filePath: string) => Promise<{title:string|null;artist:string|null;album:string|null;year:number|null;artwork:string|null;duration:number|null;bitrate:number|null}|null>;
      openOne: () => Promise<MediaFile[]>;
      openFolder: () => Promise<MediaFile[]>;
      restoreFiles: (paths: string[]) => Promise<MediaFile[]>;
      findSubtitle: (filePath: string) => Promise<{name:string;content:string;path:string}|null>;
      saveSnapshot: (dataUrl: string, suggestedName: string) => Promise<{canceled:boolean;filePath?:string}>;
      setAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
      minimize: () => Promise<void>;
      maximize: () => Promise<boolean>;
      close: () => Promise<void>;
      onMenu: (callback: (action: string) => void) => () => void;
    };
  }
}

export {};