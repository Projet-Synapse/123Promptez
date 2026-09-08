// app.config.js rather than app.json alone: experiments.baseUrl must stay empty
// in local/desktop (root server) and only be set for GitHub Pages (served under
// /123Promptez/), so it is read dynamically from GH_PAGES_BASE_URL.
//
// android.package must be explicit here: with a dynamic config, `expo
// prebuild` can no longer write back into app.json, and refuses to run
// without a package name (broke the APK job of release v1.6.0).

const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...(appJson.expo.android || {}),
      package: appJson.expo.android?.package || "com.anonymous.onspaceapp",
    },
    experiments: {
      ...(appJson.expo.experiments || {}),
      baseUrl: process.env.GH_PAGES_BASE_URL || undefined,
    },
  },
};
