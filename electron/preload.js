// Preload bridge — vault folder pick + text file listing for desktop sync.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronVault', {
  pickFolder: () => ipcRenderer.invoke('vault:pick-folder'),
  listTextFiles: (dirPath) => ipcRenderer.invoke('vault:list-text-files', dirPath),
});
