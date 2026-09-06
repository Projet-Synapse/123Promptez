// Preload bridge — vault folder pick + desktop shortcuts.
const { contextBridge, ipcRenderer } = require('electron');

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
