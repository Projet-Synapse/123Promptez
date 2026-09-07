/* eslint-env node */
// Electron main process — wraps the Expo web build (React Native Web) as a
// desktop app for Windows/macOS/Linux. No native RN code runs here; the
// window simply loads the same static bundle produced by `expo export --platform web`.
const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { startStaticServer } = require('./static-server');
const { autoUpdater } = require('electron-updater');

// In dev, point ELECTRON_START_URL at the Expo web dev server
// (npm run web / expo start --web, usually http://localhost:8081) — that
// already serves from a real HTTP origin, so no local server is needed.
const DEV_START_URL = process.env.ELECTRON_START_URL;

let mainWindow = null;
let staticServer = null;

// ── Mise à jour automatique (préférence persistée) ──────────────────────────
// L'option vit côté process principal (userData/preferences.json) : le
// renderer ne fait que l'afficher et la basculer via updates:get-auto /
// updates:set-auto. Désactivée par défaut — comportement historique.
let autoUpdateEnabled = false;

function prefsPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadUpdatePref() {
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), 'utf8'));
    if (typeof raw?.autoUpdate === 'boolean') autoUpdateEnabled = raw.autoUpdate;
  } catch {
    // Premier lancement ou fichier illisible : on garde la valeur par défaut.
  }
}

function saveUpdatePref() {
  try {
    fs.writeFileSync(prefsPath(), JSON.stringify({ autoUpdate: autoUpdateEnabled }), 'utf8');
  } catch (err) {
    console.error('[updates] écriture des préférences impossible:', err);
  }
}

function applyUpdateFlags() {
  autoUpdater.autoDownload = autoUpdateEnabled;
  autoUpdater.autoInstallOnAppQuit = autoUpdateEnabled;
}

function sendUpdateEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:event', payload);
  }
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;

  loadUpdatePref();
  applyUpdateFlags();

  autoUpdater.on('checking-for-update', () => sendUpdateEvent({ type: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    sendUpdateEvent({ type: 'available', version: info.version }));
  autoUpdater.on('update-not-available', (info) =>
    sendUpdateEvent({ type: 'not-available', version: info.version }));
  autoUpdater.on('download-progress', (p) =>
    sendUpdateEvent({ type: 'progress', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) =>
    sendUpdateEvent({ type: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) =>
    sendUpdateEvent({ type: 'error', message: String(err?.message ?? err) }));

  // Vérification silencieuse au lancement ; en mode auto, une version
  // détectée se télécharge toute seule (autoDownload) et l'installeur
  // remplace l'app à la prochaine fermeture. En mode manuel, ce sont les
  // dialogs ci-dessous qui proposent de télécharger puis redémarrer.
  autoUpdater.checkForUpdates().catch((err) =>
    console.error('[updates] vérification au démarrage échouée:', err));
}

// En mode manuel, traduit les événements en dialogs (l'app n'avait pas de
// filet electron-updater avant : on garde une expérience bouton, sans rien
// imposer). En mode auto, un seul dialog quand la version est prête.
function setupManualUpdateDialogs() {
  if (!app.isPackaged) return;
  let manualDownloadStarted = false;

  autoUpdater.on('update-available', async (info) => {
    if (autoUpdateEnabled || manualDownloadStarted) return;
    manualDownloadStarted = true;
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Télécharger', 'Plus tard'],
      defaultId: 0,
      message: `Une nouvelle version est disponible (v${info.version})`,
      detail: `Vous utilisez actuellement la version ${app.getVersion()}.`,
    });
    if (response === 0) {
      autoUpdater.downloadUpdate().catch((err) =>
        console.error('[updates] téléchargement échoué:', err));
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    if (autoUpdateEnabled) {
      // L'installation se fera toute seule à la fermeture ; on propose
      // quand même de redémarrer tout de suite.
      const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Redémarrer et installer', 'À la fermeture'],
        defaultId: 0,
        message: `La version ${info.version} est prête à installer`,
        detail: "Elle s'installera automatiquement à la fermeture de l'application, ou redémarrez maintenant.",
      });
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    } else {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        buttons: ['Redémarrer et installer', 'Plus tard'],
        defaultId: 0,
        message: `La version ${info.version} a été téléchargée`,
        detail: 'Redémarrer maintenant pour l\'installer ?',
      });
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    }
  });
}

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
  // La vérification passe désormais par electron-updater : en mode manuel,
  // les dialogs « version disponible / prête à installer » sont gérés par
  // setupManualUpdateDialogs (déclenchés par les événements). Ici on ne
  // gère que le cas explicite « déjà à jour » et l'échec réseau.
  try {
    const result = await autoUpdater.checkForUpdates();
    const latest = result?.updateInfo?.version;
    if (!silentIfUpToDate && !autoUpdateEnabled && latest === app.getVersion()) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Vous utilisez déjà la dernière version.',
        detail: `Version actuelle : ${app.getVersion()}`,
      });
    }
  } catch {
    if (!silentIfUpToDate) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Impossible de vérifier les mises à jour pour le moment.',
        detail: "Vérifiez votre connexion, ou réessayez plus tard.",
      });
    }
  }
}

function sendShortcut(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:shortcut', action);
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
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouvelle conversation',
          accelerator: 'CommandOrControl+N',
          click: () => sendShortcut('new-conversation'),
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Affichage',
      submenu: [
        {
          label: 'Palette de commandes',
          accelerator: 'CommandOrControl+K',
          click: () => sendShortcut('command-palette'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
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

// ── Updates IPC ──────────────────────────────────────────────────────────────
ipcMain.on('app:version', (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) {
    return { updateAvailable: false, error: 'Mises à jour désactivées en développement' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version;
    return { updateAvailable: version !== app.getVersion(), version };
  } catch (error) {
    console.error('[updates] vérification échouée:', error);
    return { updateAvailable: false, error: String(error?.message ?? error) };
  }
});

ipcMain.handle('updates:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    console.error('[updates] téléchargement échoué:', error);
    return { ok: false, error: String(error?.message ?? error) };
  }
});

// Redémarre l'app, l'installeur remplace la version installée, puis relance.
ipcMain.on('updates:install', () => {
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
});

ipcMain.handle('updates:get-auto', () => autoUpdateEnabled);

ipcMain.handle('updates:set-auto', (_event, enabled) => {
  autoUpdateEnabled = Boolean(enabled);
  saveUpdatePref();
  applyUpdateFlags();
  console.log(`[updates] mise à jour automatique ${autoUpdateEnabled ? 'activée' : 'désactivée'}`);
  return autoUpdateEnabled;
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
  setupAutoUpdate();
  setupManualUpdateDialogs();

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
