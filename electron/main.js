// Electron main process — wraps the Expo web build (React Native Web) as a
// desktop app for Windows/macOS/Linux. No native RN code runs here; the
// window simply loads the same static bundle produced by `expo export --platform web`.
const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
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
