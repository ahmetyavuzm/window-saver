import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const YABAI_MISSING_MESSAGE =
  'yabai bulunamadı. Space (masaüstü) desteği için yabai kurulu ve çalışır olmalı: ' +
  '"brew install yabai" (veya kullandığınız fork), ardından "yabai --start-service" ve ' +
  'Sistem Ayarları > Gizlilik ve Güvenlik > Erişilebilirlik izni gerekli.';

interface YabaiDisplay {
  index: number;
  frame: { x: number; y: number; w: number; h: number };
  spaces: number[]; // global Space indices on this display, in order
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

export async function queryDisplays(): Promise<YabaiDisplay[]> {
  const stdout = await runYabai(['query', '--displays']);
  return JSON.parse(stdout) as YabaiDisplay[];
}

/**
 * Translate a per-display desktop into yabai's current global Space index.
 *
 * yabai numbers Spaces globally, display-by-display (display 1's Spaces first,
 * then display 2's, …), so the same "2nd desktop of this screen" maps to a
 * different global index whenever desktops/displays change. We therefore resolve
 * it fresh at run time: match the box's display to a yabai display by frame
 * origin, then index into that display's ordered `spaces` array.
 *
 * Returns the global Space index, or `null` when the display can't be matched
 * (yabai down / arrangement changed) or it has fewer than `localDesktop`
 * desktops — the caller turns `null` into an actionable error.
 */
export async function resolveDisplaySpaceIndex(
  displayBounds: { x: number; y: number },
  localDesktop: number,
): Promise<number | null> {
  const displays = await queryDisplays();
  if (displays.length === 0) return null;

  const targetX = Math.round(displayBounds.x);
  const targetY = Math.round(displayBounds.y);
  const exact = displays.find(
    (d) => Math.round(d.frame.x) === targetX && Math.round(d.frame.y) === targetY,
  );
  const match =
    exact ??
    displays.reduce((best, d) => {
      const dist = (d.frame.x - displayBounds.x) ** 2 + (d.frame.y - displayBounds.y) ** 2;
      const bestDist = (best.frame.x - displayBounds.x) ** 2 + (best.frame.y - displayBounds.y) ** 2;
      return dist < bestDist ? d : best;
    }, displays[0]);

  if (localDesktop < 1 || localDesktop > match.spaces.length) return null;
  return match.spaces[localDesktop - 1];
}

function isBenignYabaiNoop(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already focused|already on this space/i.test(message);
}

export async function moveFocusedWindowToSpace(spaceIndex: number): Promise<void> {
  try {
    await runYabai(['window', '--space', String(spaceIndex)]);
  } catch (error) {
    if (!isBenignYabaiNoop(error)) throw error;
  }
  try {
    await runYabai(['space', '--focus', String(spaceIndex)]);
  } catch (error) {
    if (!isBenignYabaiNoop(error)) throw error;
  }
}

export { YABAI_MISSING_MESSAGE };
