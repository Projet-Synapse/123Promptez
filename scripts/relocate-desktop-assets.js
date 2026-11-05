#!/usr/bin/env node
/* eslint-env node */
// `expo export` range les polices d\'icônes (@expo/vector-icons) et les images
// d\'expo-router / react-navigation sous `assets/node_modules/...`. Or
// electron-builder écarte TOUT dossier `node_modules` (voir package.json
// build.files : "!**/node_modules/**/*"), même sous `dist/**/*` : sans ce
// script, l\'installeur n\'embarque aucun `dist/assets/` utile → les .ttf
// répondent 404 et toutes les icônes s\'affichent en carrés vides (même
// bug qu\'avait 123Créez avant le correctif d8d6340).
//
// On renomme chaque dossier node_modules → _nm dans dist/assets et on
// réécrit les références. Uniquement pour le paquet Electron ; le zip web
// / GitHub Pages n\'a pas besoin de ça.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd(); // lancé depuis la racine du repo (npm / CI)
const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "dist");

function relocateNodeModulesAssets(rendererDir) {
  const assetsDir = path.join(rendererDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    console.log(`• pas de ${path.relative(ROOT, assetsDir)} — rien à faire`);
    return;
  }
  const dirs = [];
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      collect(full);
      if (entry.name === "node_modules") dirs.push(full);
    }
  };
  collect(assetsDir);
  for (const dir of dirs) {
    fs.renameSync(dir, path.join(path.dirname(dir), "_nm"));
  }
  if (dirs.length === 0) {
    console.log("• aucun assets/**/node_modules trouvé");
    return;
  }
  const URL_RE = /\/assets\/[^"\'`\s)]*/g;
  let rewritten = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html|css|json)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf-8");
        const next = text.replace(URL_RE, (url) =>
          url.split("/node_modules/").join("/_nm/"),
        );
        if (next !== text) {
          fs.writeFileSync(full, next);
          rewritten++;
        }
      }
    }
  };
  walk(rendererDir);
  console.log(
    `• ${dirs.length} dossiers assets/**/node_modules → _nm (${rewritten} fichiers réécrits) dans ${path.relative(ROOT, rendererDir)}`,
  );
}

relocateNodeModulesAssets(target);
