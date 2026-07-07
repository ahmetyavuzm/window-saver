import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

// Where macOS keeps user-launchable apps. We scan the top level plus one nested
// level (e.g. /Applications/Utilities, /System/Applications/Utilities) — deeper
// bundles are rare and not worth the extra I/O.
const APP_DIRS = [
  '/Applications',
  '/System/Applications',
  path.join(homedir(), 'Applications'),
];

async function appsInDir(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return []; // dir may not exist (e.g. no ~/Applications) — skip quietly.
  }
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.endsWith('.app')) {
      names.push(entry.slice(0, -'.app'.length));
    } else if (!entry.includes('.')) {
      // A plain subfolder (e.g. "Utilities") — scan one level deeper for apps.
      try {
        const nested = await readdir(path.join(dir, entry));
        for (const n of nested) {
          if (n.endsWith('.app')) names.push(n.slice(0, -'.app'.length));
        }
      } catch {
        // Not a readable directory — ignore.
      }
    }
  }
  return names;
}

/**
 * List installed application names (without the ".app" suffix) for the Launch
 * App picker. These are the *real* app names macOS's `open -a` expects, so
 * picking from this list also sidesteps the process-name/app-name mismatch that
 * made `open -a Code` fail. Deduplicated and sorted case-insensitively.
 */
export async function listInstalledApps(): Promise<string[]> {
  const lists = await Promise.all(APP_DIRS.map(appsInDir));
  const unique = new Set<string>(lists.flat());
  return [...unique].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
