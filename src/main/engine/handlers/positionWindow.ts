import { screen } from 'electron';
import type { Step, LogEntry } from '../../../shared/types.js';
import { runAppleScript, resolveProcessRef, toAppleScriptString } from '../applescript.js';
import { isYabaiAvailable, ensureSpaceCount, moveFocusedWindowToSpace, YABAI_MISSING_MESSAGE } from '../yabai.js';
import { computeTargetBounds, resolveDisplayForPlacement, boundsFromNormalizedRect } from '../geometry.js';

type PositionWindowStep = Extract<Step, { type: 'positionWindow' }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWindowRef(appName: string, windowTitle?: string): Promise<string> {
  const processRef = await resolveProcessRef(appName);
  return windowTitle
    ? `first window of (${processRef}) whose name contains "${toAppleScriptString(windowTitle)}"`
    : `window 1 of (${processRef})`;
}

async function getWindowBounds(windowRef: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const result = await runAppleScript(`
    tell application "System Events"
      set targetWindow to (${windowRef})
      set {winX, winY} to position of targetWindow
      set {winW, winH} to size of targetWindow
      return (winX as text) & "," & (winY as text) & "," & (winW as text) & "," & (winH as text)
    end tell
  `);
  const [x, y, width, height] = result.split(',').map((n) => parseInt(n.trim(), 10));
  return { x, y, width, height };
}

async function setWindowBounds(
  windowRef: string,
  bounds: { x: number; y: number; width: number; height: number },
): Promise<void> {
  // Order matters for displays at negative coordinates (a secondary display
  // positioned above/left of the primary): setting position first while the
  // window still has its old size can leave it mostly off every display,
  // which macOS then refuses to resize (-10006). Setting size first, then
  // position, avoids that intermediate off-screen state.
  await runAppleScript(`
    tell application "System Events"
      set targetWindow to (${windowRef})
      set size of targetWindow to {${bounds.width}, ${bounds.height}}
      set position of targetWindow to {${bounds.x}, ${bounds.y}}
    end tell
  `);
}

export async function handlePositionWindow(
  step: PositionWindowStep,
  knownWindowTitle?: string,
): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  try {
    // "activate" reliably brings the app to the actual OS-level front. System
    // Events' "set frontmost of process to true" can silently fail to stick
    // (observed with Chrome), leaving us acting on the wrong window even
    // though this step would otherwise report success.
    await runAppleScript(`tell application "${toAppleScriptString(step.appName)}" to activate`);
    await sleep(300);

    // Prefer the title captured when a preceding step in this same box
    // opened the window (e.g. openTerminal) over the user-configured
    // windowTitle, which may be blank for auto-generated boxes.
    const effectiveWindowTitle = step.windowTitle ?? knownWindowTitle;
    const windowRef = await getWindowRef(step.appName, effectiveWindowTitle);

    if (effectiveWindowTitle) {
      await runAppleScript(`
        tell application "System Events"
          perform action "AXRaise" of (${windowRef})
        end tell
      `);
      await sleep(200);
    }

    if (step.spaceIndex !== undefined) {
      if (!(await isYabaiAvailable())) {
        return { status: 'error', message: YABAI_MISSING_MESSAGE };
      }
      await ensureSpaceCount(step.spaceIndex);
      await moveFocusedWindowToSpace(step.spaceIndex);
      await sleep(300);
    }

    // Rectangle's URL scheme (rectangle://execute-action) turned out to be
    // unreliable — it silently no-ops on some setups. Computing and setting
    // the window frame directly via System Events has no external dependency
    // and is the same mechanism already proven reliable for reading bounds.
    let targetBounds: { x: number; y: number; width: number; height: number };
    let fallbackReason: string | undefined;
    let actionLabel: string;

    if (step.placement) {
      const resolution = resolveDisplayForPlacement(step.placement.display);
      fallbackReason = resolution.fallbackReason;
      targetBounds = boundsFromNormalizedRect(step.placement.rect, resolution.display.workArea);
      actionLabel = 'custom placement';
    } else {
      const currentBounds = await getWindowBounds(windowRef);
      const display = screen.getDisplayNearestPoint({
        x: Math.round(currentBounds.x + currentBounds.width / 2),
        y: Math.round(currentBounds.y + currentBounds.height / 2),
      });
      targetBounds = computeTargetBounds(step.rectangleAction ?? 'maximize', display.workArea);
      actionLabel = step.rectangleAction ?? 'maximize';
    }
    await setWindowBounds(windowRef, targetBounds);

    const detail = [
      effectiveWindowTitle ? `window "${effectiveWindowTitle}"` : null,
      step.spaceIndex !== undefined ? `space ${step.spaceIndex}` : null,
      fallbackReason ?? null,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      status: 'ok',
      message: `Positioned ${step.appName}${detail ? ` (${detail})` : ''} → ${actionLabel}`,
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to position ${step.appName}: ${(error as Error).message}`,
    };
  }
}
