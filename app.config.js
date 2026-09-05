// app.config.js rather than app.json alone: experiments.baseUrl must stay empty
// in local/desktop (root server) and only be set for GitHub Pages (served under
// /123Promptez/), so it is read dynamically from GH_PAGES_BASE_URL.

const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    experiments: {
      ...(appJson.expo.experiments || {}),
      baseUrl: process.env.GH_PAGES_BASE_URL || undefined,
    },
  },
};
