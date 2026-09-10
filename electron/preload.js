// Preload bridge — vault folder pick, deux sens (écritures + surveillance),
// raccourcis desktop, mises à jour desktop.
const { contextBridge, ipcRenderer } = require('electron');

const UPDATE_EVENT_CHANNEL = 'updates:event';

contextBridge.exposeInMainWorld('electronVault', {
  pickFolder: () => ipcRenderer.invoke('vault:pick-folder'),
  listTextFiles: (dirPath) => ipcRenderer.invoke('vault:list-text-files', dirPath),
  // Écritures (app → disque), confinées à la racine du vault côté main.
  writeFile: (rootPath, relPath, content) => ipcRenderer.invoke('vault:write-file', rootPath, relPath, content),
  makeDir: (rootPath, relPath) => ipcRenderer.invoke('vault:make-dir', rootPath, relPath),
  deletePath: (rootPath, relPath, isDir) => ipcRenderer.invoke('vault:delete-path', rootPath, relPath, isDir),
  movePath: (rootPath, fromRel, toRel) => ipcRenderer.invoke('vault:move-path', rootPath, fromRel, toRel),
  openPath: (targetPath) => ipcRenderer.invoke('vault:open-path', targetPath),
  // Surveillance (disque → app) : debounce côté main, évènement « vault:changed ».
  watch: (rootPath) => ipcRenderer.invoke('vault:watch', rootPath),
  unwatch: (rootPath) => ipcRenderer.invoke('vault:unwatch', rootPath),
  onChanged: (callback) => {
    const handler = (_evt, payload) => callback(payload);
    ipcRenderer.on('vault:changed', handler);
    return () => ipcRenderer.removeListener('vault:changed', handler);
  },
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
