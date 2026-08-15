// Lightweight update checker for the desktop app.
//
// Deliberately NOT electron-updater: that expects electron-builder to
// publish latest.yml/latest-mac.yml/latest-linux.yml feed files (via
// `--publish always`) and, for silent auto-download, code-signed builds on
// macOS/Windows — none of which this project has set up. Instead this just
// compares the running version against the latest GitHub Release tag and
// offers to open that release's page. No silent downloads, no signing
// requirement, nothing to get subtly out of sync with the CI workflow.
//
// Keep GITHUB_REPO in sync with services/updateService.ts (the in-app
// RN/web equivalent of this same check).
const GITHUB_REPO = 'catelyn2332-design/123Promptez';

function parseVersion(v) {
  // Accepts "1.2.3" or "v1.2.3"; ignores any pre-release/build suffix.
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

/**
 * @param {string} currentVersion
 * @returns {Promise<{available: boolean, latestVersion: string, url: string} | null>}
 *   Resolves to null on any network/API error (offline, rate-limited, repo
 *   still private, ...) — this must never throw or block app startup.
 */
async function checkForUpdate(currentVersion) {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const release = await res.json();
    const latestVersion = String(release.tag_name ?? '').replace(/^v/, '');
    return {
      available: isNewer(latestVersion, currentVersion),
      latestVersion,
      url: release.html_url,
    };
  } catch {
    return null;
  }
}

module.exports = { checkForUpdate, isNewer, parseVersion, GITHUB_REPO };
