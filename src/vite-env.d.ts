/// <reference types="vite/client" />

type MediaFile = { name: string; path: string; url: string };

declare global {
  interface Window {
    merci?: {
      openFiles: () => Promise<MediaFile[]>;
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