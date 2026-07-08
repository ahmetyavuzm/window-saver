import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  return stdout.trim();
}

// Runs an osascript in JavaScript-for-Automation mode. Used for the few things
// that need the ObjC bridge (e.g. CoreGraphics window geometry) which classic
// AppleScript can't reach.
export async function runJXA(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script]);
  return stdout.trim();
}

export async function runShell(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args);
}

// Best-effort PID resolution via System Events (bundle-id matched), polling
// briefly because a just-launched app registers with System Events late.
// Returns undefined instead of throwing — callers treat it as "not trackable".
export async function resolveAppPid(appName: string, timeoutMs = 4000): Promise<number | undefined> {
  const processRef = await resolveProcessRef(appName);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await runAppleScript(`tell application "System Events" to unix id of (${processRef})`);
      const pid = parseInt(result, 10);
      if (!Number.isNaN(pid)) return pid;
    } catch {
      // process may not have registered with System Events yet; keep polling
    }
    await sleep(200);
  }
  return undefined;
}

// System Events registers a running app under its executable's process name,
// which often differs from the display name used to launch it (e.g.
// "Visual Studio Code" runs as process "Code"). Resolving the bundle
// identifier lets callers reference the process reliably regardless of that
// naming mismatch.
export async function resolveProcessRef(appName: string): Promise<string> {
  const escapedName = toAppleScriptString(appName);
  try {
    const bundleId = await runAppleScript(`id of application "${escapedName}"`);
    if (bundleId) {
      return `first process whose bundle identifier is "${toAppleScriptString(bundleId)}"`;
    }
  } catch {
    // fall back to name-based matching below
  }
  return `process "${escapedName}"`;
}
