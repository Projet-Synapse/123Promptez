// No privileged Node/Electron APIs are exposed to the renderer — the app is
// a plain React Native Web bundle and doesn't need a bridge. This file only
// exists to satisfy contextIsolation + sandbox requirements in main.js.
