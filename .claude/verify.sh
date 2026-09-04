#!/usr/bin/env bash
cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! OUT=$(npx tsc --noEmit 2>&1); then
  echo "❌ Erreurs TypeScript — corrige-les avant de conclure :" >&2
  echo "$OUT" >&2
  exit 2
fi

if ! OUT=$(npm run lint 2>&1); then
  echo "❌ Erreurs ESLint — corrige-les avant de conclure :" >&2
  echo "$OUT" >&2
  exit 2
fi

exit 0