import { randomUUID } from 'node:crypto';
import type { CapturedWindow, DisplayInfo, NormalizedRect, Step } from '../../shared/types.js';
import { listDisplays } from '../displays.js';
import { runAppleScript } from './applescript.js';
import { queryDisplays, querySpaces, queryWindows } from './yabai.js';

// Resolve a running process's bundle identifier from its pid via System Events.
// Best-effort: any failure (process gone, no bundle id) yields undefined so the
// launch step just falls back to `open -a <appName>`.
async function resolveBundleId(pid: number): Promise<string | undefined> {
  try {
    const id = (
      await runAppleScript(
        `tell application "System Events" to get bundle identifier of (first process whose unix id is ${pid})`,
      )
    ).trim();
    return id && id !== 'missing value' ? id : undefined;
  } catch {
    return undefined;
  }
}

// Our own app should not be captured into the profile it is helping create.
const SELF_APP_NAMES = new Set(['window-saver', 'Window Saver', 'Electron']);

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Global px window frame → workArea-relative NormalizedRect (the same 0..1 space
// the layout builder stores). Clamped so a window straddling menu bar / edges
// still yields a valid rect.
function normalizeFrame(
  frame: { x: number; y: number; w: number; h: number },
  workArea: { x: number; y: number; width: number; height: number },
): NormalizedRect {
  return {
    x: clamp01((frame.x - workArea.x) / workArea.width),
    y: clamp01((frame.y - workArea.y) / workArea.height),
    width: clamp01(frame.w / workArea.width),
    height: clamp01(frame.h / workArea.height),
  };
}

// Map each yabai display index → the Electron DisplayInfo at the same origin.
function yabaiDisplayToElectron(
  yabaiDisplays: { index: number; frame: { x: number; y: number } }[],
  electron: DisplayInfo[],
): Map<number, DisplayInfo> {
  const map = new Map<number, DisplayInfo>();
  for (const yd of yabaiDisplays) {
    const match =
      electron.find((e) => Math.round(e.bounds.x) === Math.round(yd.frame.x) && Math.round(e.bounds.y) === Math.round(yd.frame.y)) ??
      electron.reduce((best, e) => {
        const dist = (e.bounds.x - yd.frame.x) ** 2 + (e.bounds.y - yd.frame.y) ** 2;
        const bestDist = (best.bounds.x - yd.frame.x) ** 2 + (best.bounds.y - yd.frame.y) ** 2;
        return dist < bestDist ? e : best;
      }, electron[0]);
    if (match) map.set(yd.index, match);
  }
  return map;
}

/**
 * Snapshot the currently open, positioned windows so they can be turned into a
 * profile. Requires yabai. Each real (standard, visible) window is mapped to its
 * Electron display, a workArea-relative rect, the per-display desktop it sits on
 * (native-fullscreen Spaces excluded from the count), and a fullscreen flag.
 */
export async function captureWindows(): Promise<CapturedWindow[]> {
  const [windows, spaces, yabaiDisplays, electronDisplays] = await Promise.all([
    queryWindows(),
    querySpaces(),
    queryDisplays(),
    Promise.resolve(listDisplays()),
  ]);

  const displayMap = yabaiDisplayToElectron(yabaiDisplays, electronDisplays);

  // Per-yabai-display ordered list of regular (non-fullscreen) global Spaces, so
  // a window's global space → 1-based desktop index within its display.
  const regularByDisplay = new Map<number, number[]>();
  for (const s of spaces) {
    if (s['is-native-fullscreen']) continue;
    const list = regularByDisplay.get(s.display) ?? [];
    list.push(s.index);
    regularByDisplay.set(s.display, list);
  }
  for (const list of regularByDisplay.values()) list.sort((a, b) => a - b);

  const captured: CapturedWindow[] = [];
  const bundleIdByPid = new Map<number, string | undefined>();
  for (const win of windows) {
    if (win.role !== 'AXWindow' || win.subrole !== 'AXStandardWindow') continue;
    if (win['is-minimized'] || win['is-hidden'] || !win['root-window']) continue;
    if (SELF_APP_NAMES.has(win.app)) continue;

    const display = displayMap.get(win.display);
    if (!display) continue;

    // Resolve the bundle id once per pid (apps often have several windows).
    if (!bundleIdByPid.has(win.pid)) bundleIdByPid.set(win.pid, await resolveBundleId(win.pid));

    const fullscreen = win['is-native-fullscreen'];
    let desktopIndex: number | undefined;
    if (!fullscreen) {
      const pos = (regularByDisplay.get(win.display) ?? []).indexOf(win.space);
      // pos 0 == Desktop 1 (current); store undefined for it, like the builder.
      desktopIndex = pos > 0 ? pos + 1 : undefined;
    }

    captured.push({
      appName: win.app,
      bundleId: bundleIdByPid.get(win.pid),
      title: win.title,
      displayId: display.id,
      rect: normalizeFrame(win.frame, display.workArea),
      desktopIndex,
      fullscreen,
    });
  }
  return captured;
}

/**
 * Turn captured windows into profile steps (one launchApp + waitForWindow +
 * positionWindow group per window), mirroring the renderer's box builder so the
 * layout editor treats them like any other box.
 */
export function stepsFromCapturedWindows(windows: CapturedWindow[]): Step[] {
  const displays = listDisplays();
  const steps: Step[] = [];
  for (const win of windows) {
    const display = displays.find((d) => d.id === win.displayId) ?? displays[0];
    if (!display) continue;
    const groupId = randomUUID();
    steps.push({ type: 'launchApp', id: `${groupId}-launch`, appName: win.appName, bundleId: win.bundleId, groupId });
    steps.push({ type: 'waitForWindow', id: `${groupId}-wait`, appName: win.appName, timeoutMs: 8000, groupId });
    steps.push({
      type: 'positionWindow',
      id: `${groupId}-position`,
      appName: win.appName,
      groupId,
      placement: {
        display: { displayId: display.id, widthPx: display.bounds.width, heightPx: display.bounds.height },
        rect: win.rect,
      },
      ...(win.desktopIndex !== undefined ? { desktopIndex: win.desktopIndex } : {}),
      ...(win.fullscreen ? { fullscreen: true } : {}),
    });
  }
  return steps;
}
