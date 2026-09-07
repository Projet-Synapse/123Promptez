// Pont desktop pour les mises à jour (window.promptezDesktop, exposé par
// electron/preload.js) — absent hors de l'app desktop installée.

export type DesktopUpdateEventType =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'progress'
  | 'downloaded'
  | 'error';

export interface DesktopUpdateEvent {
  type: DesktopUpdateEventType;
  version?: string;
  percent?: number;
  message?: string;
}

export interface DesktopUpdatesBridge {
  platform: 'linux' | 'darwin' | 'win32';
  appVersion: string;
  checkForUpdates: () => Promise<{ updateAvailable: boolean; version?: string; error?: string }>;
  downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
  quitAndInstall: () => void;
  getAutoUpdate: () => Promise<boolean>;
  setAutoUpdate: (enabled: boolean) => Promise<boolean>;
  onUpdateEvent: (handler: (event: DesktopUpdateEvent) => void) => () => void;
}

declare global {
  interface Window {
    promptezDesktop?: DesktopUpdatesBridge;
  }
}

/** Vrai quand le bundle web tourne dans la coquille Electron installée. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!window.promptezDesktop;
}

export function getDesktopBridge(): DesktopUpdatesBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.promptezDesktop;
}
