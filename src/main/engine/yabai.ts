import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { YabaiInstallResult } from '../../shared/types.js';
import { sleep } from './applescript.js';

const execFileAsync = promisify(execFile);

// GUI apps launched from Finder don't inherit the shell's PATH, so Homebrew's
// bin dir (Apple Silicon vs Intel default prefix) is often missing even when
// installed. Check the well-known locations before falling back to bare PATH.
const BREW_CANDIDATES = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];

function resolveBrewPath(): string | null {
  for (const candidate of BREW_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export const YABAI_MISSING_MESSAGE =
  'yabai bulunamadı. Space (masaüstü) desteği için yabai kurulu ve çalışır olmalı: ' +
  '"brew install yabai" (veya kullandığınız fork), ardından "yabai --start-service" ve ' +
  'Sistem Ayarları > Gizlilik ve Güvenlik > Erişilebilirlik izni gerekli.';

interface YabaiDisplay {
  index: number;
  frame: { x: number; y: number; w: number; h: number };
  spaces: number[]; // global Space indices on this display, in order
}

interface YabaiSpace {
  index: number; // global Space index
  display: number; // yabai display index this Space belongs to
  'is-native-fullscreen': boolean;
}

export interface YabaiWindow {
  id: number; // == CGWindowNumber
  app: string;
  pid: number;
  title: string;
  frame: { x: number; y: number; w: number; h: number };
  display: number; // yabai display index
  space: number; // global Space index
  role: string;
  subrole: string;
  'is-native-fullscreen': boolean;
  'is-minimized': boolean;
  'is-hidden': boolean;
  'root-window': boolean;
}

// Match a physical display (by frame origin) to its yabai display. Nearest
// origin wins so a small rounding/arrangement drift still resolves.
function matchYabaiDisplay(
  displays: YabaiDisplay[],
  displayBounds: { x: number; y: number },
): YabaiDisplay | null {
  if (displays.length === 0) return null;
  const targetX = Math.round(displayBounds.x);
  const targetY = Math.round(displayBounds.y);
  const exact = displays.find(
    (d) => Math.round(d.frame.x) === targetX && Math.round(d.frame.y) === targetY,
  );
  if (exact) return exact;
  return displays.reduce((best, d) => {
    const dist = (d.frame.x - displayBounds.x) ** 2 + (d.frame.y - displayBounds.y) ** 2;
    const bestDist = (best.frame.x - displayBounds.x) ** 2 + (best.frame.y - displayBounds.y) ** 2;
    return dist < bestDist ? d : best;
  }, displays[0]);
}

async function runYabai(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('yabai', ['-m', ...args]);
  return stdout.trim();
}

export async function isYabaiAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yabai', ['-v']);
    return true;
  } catch {
    return false;
  }
}

// Automates the part that's actually automatable (brew install + start the
// service). Granting Accessibility and loading the scripting-addition need
// user interaction / a SIP change respectively, so we stop short of those and
// tell the user what's left.
export async function installYabai(): Promise<YabaiInstallResult> {
  const brewPath = resolveBrewPath();
  if (!brewPath) {
    return {
      ok: false,
      message:
        "Homebrew bulunamadı. Önce https://brew.sh adresindeki kurulum komutunu Terminal'de çalıştırın, ardından tekrar deneyin.",
    };
  }

  try {
    await execFileAsync(brewPath, ['install', 'yabai'], { maxBuffer: 1024 * 1024 * 20 });
  } catch (err) {
    return { ok: false, message: `yabai kurulumu başarısız: ${(err as Error).message}` };
  }

  const yabaiPath = path.join(path.dirname(brewPath), 'yabai');
  try {
    await execFileAsync(existsSync(yabaiPath) ? yabaiPath : 'yabai', ['--start-service']);
  } catch (err) {
    return {
      ok: false,
      message: `yabai kuruldu ama servis başlatılamadı: ${(err as Error).message}. Terminal'de "yabai --start-service" deneyin.`,
    };
  }

  return {
    ok: true,
    message:
      "yabai kuruldu ve servis başlatıldı. Şimdi Sistem Ayarları > Gizlilik ve Güvenlik > Erişilebilirlik izninde yabai'yi işaretleyin.",
  };
}

export async function queryDisplays(): Promise<YabaiDisplay[]> {
  const stdout = await runYabai(['query', '--displays']);
  return JSON.parse(stdout) as YabaiDisplay[];
}

export async function querySpaces(): Promise<YabaiSpace[]> {
  const stdout = await runYabai(['query', '--spaces']);
  return JSON.parse(stdout) as YabaiSpace[];
}

export async function queryWindows(): Promise<YabaiWindow[]> {
  const stdout = await runYabai(['query', '--windows']);
  return JSON.parse(stdout) as YabaiWindow[];
}

// yabai is the authoritative window source when present: unlike System Events
// it sees windows on hidden Spaces, only lists windows that really exist on
// screen (activating apps expose phantom AX windows that accept `set position`
// yet never render — observed with Notes), and matching by PID sidesteps the
// process-name/app-name mismatch entirely.
function isRealStandardWindow(w: YabaiWindow): boolean {
  return (
    w.subrole === 'AXStandardWindow' && !w['is-minimized'] && !w['is-hidden'] && w['root-window']
  );
}

export async function queryStandardWindowsByPid(pid: number): Promise<YabaiWindow[]> {
  return (await queryWindows()).filter((w) => w.pid === pid && isRealStandardWindow(w));
}

export async function queryWindowById(windowId: number): Promise<YabaiWindow | null> {
  try {
    const stdout = await runYabai(['query', '--windows', '--window', String(windowId)]);
    return JSON.parse(stdout) as YabaiWindow;
  } catch {
    return null;
  }
}

// Move/resize a specific window (no scripting-addition needed). Resize first:
// with the old size still applied, moving to a display at negative coordinates
// can put the window fully off-screen where macOS refuses further changes.
export async function setWindowFrame(
  windowId: number,
  bounds: { x: number; y: number; width: number; height: number },
): Promise<void> {
  await runYabai(['window', String(windowId), '--resize', `abs:${bounds.width}:${bounds.height}`]);
  await runYabai(['window', String(windowId), '--move', `abs:${bounds.x}:${bounds.y}`]);
}

// Native-fullscreen a specific window; yabai only has a *toggle*, so check
// first to avoid un-fullscreening an already fullscreen window. The toggle is
// async AND silently no-ops on windows that can't fullscreen (e.g. an Open/Save
// panel), so verify the result and report it truthfully rather than assuming
// success. Returns false when the window never entered fullscreen.
export async function fullscreenWindowById(windowId: number): Promise<boolean> {
  const win = await queryWindowById(windowId);
  if (win && win['is-native-fullscreen']) return true;
  await runYabai(['window', String(windowId), '--toggle', 'native-fullscreen']);
  for (let i = 0; i < 6; i++) {
    await sleep(300);
    const after = await queryWindowById(windowId);
    if (after && after['is-native-fullscreen']) return true;
  }
  return false;
}

export async function moveWindowToSpace(windowId: number, spaceIndex: number): Promise<void> {
  try {
    await runYabai(['window', String(windowId), '--space', String(spaceIndex)]);
  } catch (error) {
    if (!isBenignYabaiNoop(error)) throw error;
  }
  try {
    await runYabai(['space', '--focus', String(spaceIndex)]);
  } catch (error) {
    if (!isBenignYabaiNoop(error)) throw error;
  }
}

/**
 * Create as many real Spaces as needed so the given display has at least
 * `target` regular (non-fullscreen) desktops. Returns how many were actually
 * created and whether the scripting-addition is missing (best-effort — the
 * caller surfaces guidance when `needsScriptingAddition` is true).
 */
export async function ensureSpacesOnDisplay(
  displayBounds: { x: number; y: number },
  target: number,
): Promise<{ created: number; needsScriptingAddition: boolean }> {
  const displays = await queryDisplays();
  const match = matchYabaiDisplay(displays, displayBounds);
  if (!match) return { created: 0, needsScriptingAddition: false };

  const current = (await querySpaces()).filter(
    (s) => s.display === match.index && !s['is-native-fullscreen'],
  ).length;

  let created = 0;
  for (let i = current; i < target; i++) {
    const res = await createSpaceOnDisplay(displayBounds);
    if (res.needsScriptingAddition) return { created, needsScriptingAddition: true };
    if (!res.created) break;
    created++;
  }
  return { created, needsScriptingAddition: false };
}

/**
 * Best-effort creation of a new macOS Space (desktop) on the given physical
 * display. Requires yabai's scripting-addition; without it yabai reports a
 * "scripting-addition" error, which we surface via `needsScriptingAddition` so
 * the UI can point the user at `sudo yabai --load-sa` instead of failing hard.
 */
async function createSpaceOnDisplay(
  displayBounds: { x: number; y: number },
): Promise<{ created: boolean; needsScriptingAddition: boolean }> {
  const displays = await queryDisplays();
  const match = matchYabaiDisplay(displays, displayBounds);
  if (!match) return { created: false, needsScriptingAddition: false };

  // Focus the target display so the new Space lands there.
  try {
    await runYabai(['display', '--focus', String(match.index)]);
  } catch {
    // Already focused / single display — ignore.
  }

  // The SA error may arrive as a non-zero exit (throw) or as stderr text on a
  // zero exit, so inspect both paths.
  try {
    const { stdout, stderr } = await execFileAsync('yabai', ['-m', 'space', '--create']);
    if (/scripting.addition/i.test(`${stdout}${stderr}`)) {
      return { created: false, needsScriptingAddition: true };
    }
    return { created: true, needsScriptingAddition: false };
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    const text = err.stderr ?? err.message ?? String(error);
    if (/scripting.addition/i.test(text)) return { created: false, needsScriptingAddition: true };
    throw error;
  }
}

/**
 * Translate a per-display desktop into yabai's current global Space index.
 *
 * yabai numbers Spaces globally, display-by-display (display 1's Spaces first,
 * then display 2's, …), so the same "2nd desktop of this screen" maps to a
 * different global index whenever desktops/displays change. We therefore resolve
 * it fresh at run time: match the box's display to a yabai display by frame
 * origin, then index into that display's ordered list of *regular* desktops.
 *
 * Native-fullscreen apps occupy their own macOS Space, which yabai lists among
 * a display's `spaces`. Those are not desktops the user arranges windows on, so
 * we exclude them (`is-native-fullscreen`) before indexing — otherwise a
 * fullscreen app sitting between desktops would shift every desktop after it.
 *
 * Returns the global Space index, or `null` when the display can't be matched
 * (yabai down / arrangement changed) or it has fewer than `localDesktop`
 * desktops — the caller turns `null` into an actionable error.
 */
export async function resolveDisplaySpaceIndex(
  displayBounds: { x: number; y: number },
  localDesktop: number,
): Promise<number | null> {
  const [displays, spaces] = await Promise.all([queryDisplays(), querySpaces()]);
  const match = matchYabaiDisplay(displays, displayBounds);
  if (!match) return null;

  // Regular (non-fullscreen) desktops on the matched display, in order. Fall
  // back to the display's raw `spaces` if the spaces query came back empty.
  const regular = spaces
    .filter((s) => s.display === match.index && !s['is-native-fullscreen'])
    .map((s) => s.index)
    .sort((a, b) => a - b);
  const ordered = regular.length > 0 ? regular : match.spaces;

  if (localDesktop < 1 || localDesktop > ordered.length) return null;
  return ordered[localDesktop - 1];
}

function isBenignYabaiNoop(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already focused|already on this space/i.test(message);
}

