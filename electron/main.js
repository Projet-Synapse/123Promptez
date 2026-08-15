// Electron main process — wraps the Expo web build (React Native Web) as a
// desktop app for Windows/macOS/Linux. No native RN code runs here; the
// window simply loads the same static bundle produced by `expo export --platform web`.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// In dev, point ELECTRON_START_URL at the Expo web dev server
// (npm run web / expo start --web, usually http://localhost:8081).
// In production, load the static export bundled alongside this file.
const START_URL =
  process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

function createWindow() {
  const win = new BrowserWindow({
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

  win.loadURL(START_URL);

  // Links opened via target="_blank" or window.open() go to the OS browser
  // instead of a second app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
