// Lightweight update checker — compares the running app version against the
// latest GitHub Release tag and reports whether a newer one exists. No
// silent/auto-download anywhere: the caller decides how to surface it (a
// banner, a dialog, ...) and the user always chooses to go get it themselves.
//
// This is the RN/web counterpart of electron/update-checker.js — the two
// are kept deliberately separate (different runtimes: Metro/RN vs plain
// Node in Electron's main process) but implement the same comparison, and
// GITHUB_REPO must be kept in sync between them.
const GITHUB_REPO = 'catelyn2332-design/123Promptez';

export interface UpdateCheckResult {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  url: string;
}

function parseVersion(v: string | undefined | null): [number, number, number] | null {
  // Accepts "1.2.3" or "v1.2.3"; ignores any pre-release/build suffix.
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v ?? '');
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(latest: string, current: string): boolean {
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
 * Never throws — resolves to `null` on any network/API error (offline,
 * rate-limited, repo still private, malformed response, ...).
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateCheckResult | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const release = await res.json();
    const latestVersion = String(release.tag_name ?? '').replace(/^v/, '');
    if (!latestVersion) return null;
    return {
      available: isNewerVersion(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      url: release.html_url,
    };
  } catch {
    return null;
  }
}
