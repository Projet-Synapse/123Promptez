const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub expo-video to prevent the Android SimpleCache duplicate-instance crash.
// This app does not use video, so we redirect all expo-video imports to a no-op module.
config.resolver = config.resolver || {};
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-video': path.resolve(__dirname, 'stubs/expo-video.js'),
};

module.exports = config;
