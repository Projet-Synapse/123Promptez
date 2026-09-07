// Preload bridge — vault folder pick, desktop shortcuts, desktop updates.
const { contextBridge, ipcRenderer } = require('electron');

const UPDATE_EVENT_CHANNEL = 'updates:event';

contextBridge.exposeInMainWorld('electronVault', {
  pickFolder: () => ipcRenderer.invoke('vault:pick-folder'),
  listTextFiles: (dirPath) => ipcRenderer.invoke('vault:list-text-files', dirPath),
});

contextBridge.exposeInMainWorld('electronApp', {
  onShortcut: (callback) => {
    const handler = (_evt, action) => callback(action);
    ipcRenderer.on('app:shortcut', handler);
    return () => ipcRenderer.removeListener('app:shortcut', handler);
  },
});

// Pont de mise à jour — absent hors de l'app desktop installée. Le renderer
// s'en sert pour la section Mises à jour de Réglages → À propos.
contextBridge.exposeInMainWorld('promptezDesktop', {
  platform: process.platform,
  appVersion: ipcRenderer.sendSync('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  /** Redémarre l'app et laisse l'installeur remplacer la version installée. */
  quitAndInstall: () => ipcRenderer.send('updates:install'),
  getAutoUpdate: () => ipcRenderer.invoke('updates:get-auto'),
  setAutoUpdate: (enabled) => ipcRenderer.invoke('updates:set-auto', enabled),
  onUpdateEvent: (handler) => {
    const listener = (_evt, payload) => handler(payload);
    ipcRenderer.on(UPDATE_EVENT_CHANNEL, listener);
    return () => ipcRenderer.removeListener(UPDATE_EVENT_CHANNEL, listener);
  },
});
