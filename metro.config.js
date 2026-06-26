const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const STUB_PATH = path.resolve(__dirname, 'stubs/expo-video.js');

// Intercept expo-video at resolution time to prevent the Android
// SimpleCache duplicate-instance crash (IllegalStateException).
// This app does not use video playback, so the stub is safe.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-video' || moduleName.startsWith('expo-video/')) {
    return { filePath: STUB_PATH, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
