/* eslint-env node */
// Electron main process — wraps the Expo web build (React Native Web) as a
// desktop app for Windows/macOS/Linux. No native RN code runs here; the
// window simply loads the same static bundle produced by `expo export --platform web`.
const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const fsp = require('fs').promises;
const path = require('path');
const { startStaticServer } = require('./static-server');
const { checkForUpdate } = require('./update-checker');

// In dev, point ELECTRON_START_URL at the Expo web dev server
// (npm run web / expo start --web, usually http://localhost:8081) — that
// already serves from a real HTTP origin, so no local server is needed.
const DEV_START_URL = process.env.ELECTRON_START_URL;

let mainWindow = null;
let staticServer = null;

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, '..', 'assets', 'images', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(startUrl);

  // Links opened via target="_blank" or window.open() go to the OS browser
  // instead of a second app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

async function runUpdateCheck({ silentIfUpToDate }) {
  const result = await checkForUpdate(app.getVersion());
  if (!result) {
    if (!silentIfUpToDate) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Impossible de vérifier les mises à jour pour le moment.',
        detail: "Vérifiez votre connexion, ou réessayez plus tard.",
      });
    }
    return;
  }
  if (result.available) {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Télécharger', 'Plus tard'],
      defaultId: 0,
      message: `Une nouvelle version est disponible (v${result.latestVersion})`,
      detail: `Vous utilisez actuellement la version ${app.getVersion()}.`,
    });
    if (response === 0) shell.openExternal(result.url);
  } else if (!silentIfUpToDate) {
    dialog.showMessageBox({
      type: 'info',
      message: 'Vous utilisez déjà la dernière version.',
      detail: `Version actuelle : ${app.getVersion()}`,
    });
  }
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.getName(),
          submenu: [
            { label: 'Vérifier les mises à jour…', click: () => runUpdateCheck({ silentIfUpToDate: false }) },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Aide',
      submenu: [
        { label: 'Vérifier les mises à jour…', click: () => runUpdateCheck({ silentIfUpToDate: false }) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}


const TEXT_EXT = new Set([
  'md', 'markdown', 'txt', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go',
  'java', 'kt', 'swift', 'c', 'cpp', 'cs', 'css', 'html', 'yml', 'yaml', 'toml',
  'env', 'sh', 'sql', 'xml', 'csv',
]);

ipcMain.handle('vault:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  const dirPath = result.filePaths[0];
  return { path: dirPath, name: path.basename(dirPath) };
});

async function listTextFilesRecursive(dirPath, prefix = '', acc = [], depth = 0) {
  if (depth > 6 || acc.length > 200) return acc;
  let entries;
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dirPath, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await listTextFilesRecursive(full, relative, acc, depth + 1);
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
      if (!TEXT_EXT.has(ext)) continue;
      try {
        const stat = await fsp.stat(full);
        if (stat.size > 512000) continue;
        const content = await fsp.readFile(full, 'utf8');
        acc.push({ name: entry.name, content, relativePath: relative });
      } catch {
        // skip unreadable
      }
    }
  }
  return acc;
}

ipcMain.handle('vault:list-text-files', async (_evt, dirPath) => {
  if (!dirPath || typeof dirPath !== 'string') return [];
  // Basic path safety — must exist and be a directory
  try {
    const st = await fsp.stat(dirPath);
    if (!st.isDirectory()) return [];
  } catch {
    return [];
  }
  return listTextFilesRecursive(dirPath);
});


app.whenReady().then(async () => {
  buildMenu();

  let startUrl = DEV_START_URL;
  if (!startUrl) {
    const distDir = path.join(__dirname, '..', 'dist');
    const { server, url } = await startStaticServer(distDir);
    staticServer = server;
    startUrl = url;
  }

  createWindow(startUrl);

  // Silent on startup — only interrupts the user when an update actually exists.
  runUpdateCheck({ silentIfUpToDate: true });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(startUrl);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (staticServer) staticServer.close();
});
