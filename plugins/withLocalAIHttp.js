// LAN addresses are user-configurable (including Tailscale), so a fixed list of
// Android networkSecurityConfig domains cannot cover them. Opt into cleartext
// at app level; all cloud transports continue to use HTTPS.
const { withAndroidManifest } = require('@expo/config-plugins');
module.exports = function withLocalAIHttp(config) {
  return withAndroidManifest(config, c => {
    c.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    return c;
  });
};
