import { screen } from 'electron';
import type { Step, LogEntry } from '../../../shared/types.js';
import { runAppleScript, resolveProcessRef, toAppleScriptString } from '../applescript.js';
import { isYabaiAvailable, ensureSpaceCount, moveFocusedWindowToSpace, YABAI_MISSING_MESSAGE } from '../yabai.js';
import { computeTargetBounds, resolveDisplayForPlacement, boundsFromNormalizedRect } from '../geometry.js';

type PositionWindowStep = Extract<Step, { type: 'positionWindow' }>;
type Bounds = { x: number; y: number; width: number; height: number };
type StepLog = Omit<LogEntry, 'stepId' | 'timestamp'>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Terminal windows can't be a target here through System Events: Terminal
// manages its own row/column geometry and macOS returns -10006 ("can't set")
// for any attempt to move/resize a Terminal window via System Events. Detect
// Terminal so it takes the native-AppleScript path instead.
function isTerminalStep(step: PositionWindowStep, knownWindowId?: number): boolean {
  return knownWindowId !== undefined || step.appName === 'Terminal';
}

// Resolves the target bounds (and a human label) for a step, independent of how
// the current bounds are read — `readCurrentBounds` is injected so the Terminal
// and System Events paths can each read geometry their own way.
async function resolveTargetBounds(
  step: PositionWindowStep,
  readCurrentBounds: () => Promise<Bounds>,
): Promise<{ bounds: Bounds; actionLabel: string; fallbackReason?: string }> {
  if (step.placement) {
    const resolution = resolveDisplayForPlacement(step.placement.display);
    return {
      bounds: boundsFromNormalizedRect(step.placement.rect, resolution.display.workArea),
      actionLabel: 'custom placement',
      fallbackReason: resolution.fallbackReason,
    };
  }
  const current = await readCurrentBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(current.x + current.width / 2),
    y: Math.round(current.y + current.height / 2),
  });
  const action = step.rectangleAction ?? 'maximize';
  return { bounds: computeTargetBounds(action, display.workArea), actionLabel: action };
}

function successMessage(step: PositionWindowStep, detailParts: (string | null)[], actionLabel: string): StepLog {
  const detail = detailParts.filter(Boolean).join(', ');
  return {
    status: 'ok',
    message: `Positioned ${step.appName}${detail ? ` (${detail})` : ''} → ${actionLabel}`,
  };
}

// ---- Terminal.app: native AppleScript positioning (no System Events) --------
// Terminal's `position`/`size` window properties use the same global,
// top-left-origin screen coordinates as Electron's `screen` module. Size is
// set before position because Terminal re-anchors the window when it resizes,
// which would otherwise shift a just-set position back off target.
async function readTerminalBounds(winRef: string): Promise<Bounds> {
  const r = await runAppleScript(`
    tell application "Terminal"
      set p to position of ${winRef}
      set s to size of ${winRef}
      return (item 1 of p as text) & "," & (item 2 of p as text) & "," & (item 1 of s as text) & "," & (item 2 of s as text)
    end tell
  `);
  const [x, y, width, height] = r.split(',').map((n) => parseInt(n.trim(), 10));
  return { x, y, width, height };
}

async function positionTerminal(step: PositionWindowStep, knownWindowId?: number): Promise<StepLog> {
  const winRef = knownWindowId !== undefined ? `window id ${knownWindowId}` : 'front window';

  if (step.spaceIndex !== undefined) {
    if (!(await isYabaiAvailable())) {
      return { status: 'error', message: YABAI_MISSING_MESSAGE };
    }
    // yabai moves the *focused* window, so bring exactly our window to front.
    await runAppleScript(`
      tell application "Terminal"
        activate
        try
          set frontmost of ${winRef} to true
        end try
      end tell
    `);
    await sleep(200);
    await ensureSpaceCount(step.spaceIndex);
    await moveFocusedWindowToSpace(step.spaceIndex);
    await sleep(300);
  }

  const { bounds, actionLabel, fallbackReason } = await resolveTargetBounds(step, () => readTerminalBounds(winRef));
  await runAppleScript(`
    tell application "Terminal"
      set size of ${winRef} to {${bounds.width}, ${bounds.height}}
      set position of ${winRef} to {${bounds.x}, ${bounds.y}}
    end tell
  `);

  return successMessage(
    step,
    [step.spaceIndex !== undefined ? `space ${step.spaceIndex}` : null, fallbackReason ?? null],
    actionLabel,
  );
}

// ---- Generic apps: System Events positioning --------------------------------
async function getWindowRef(appName: string, windowTitle?: string): Promise<string> {
  const processRef = await resolveProcessRef(appName);
  return windowTitle
    ? `first window of (${processRef}) whose name contains "${toAppleScriptString(windowTitle)}"`
    : `window 1 of (${processRef})`;
}

async function getWindowBounds(windowRef: string): Promise<Bounds> {
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

async function setWindowBounds(windowRef: string, bounds: Bounds): Promise<void> {
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

async function positionGeneric(step: PositionWindowStep): Promise<StepLog> {
  // "activate" reliably brings the app to the actual OS-level front. System
  // Events' "set frontmost of process to true" can silently fail to stick
  // (observed with Chrome), leaving us acting on the wrong window even
  // though this step would otherwise report success.
  await runAppleScript(`tell application "${toAppleScriptString(step.appName)}" to activate`);
  await sleep(300);

  const windowRef = await getWindowRef(step.appName, step.windowTitle);

  if (step.windowTitle) {
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

  const { bounds, actionLabel, fallbackReason } = await resolveTargetBounds(step, () => getWindowBounds(windowRef));
  await setWindowBounds(windowRef, bounds);

  return successMessage(
    step,
    [
      step.windowTitle ? `window "${step.windowTitle}"` : null,
      step.spaceIndex !== undefined ? `space ${step.spaceIndex}` : null,
      fallbackReason ?? null,
    ],
    actionLabel,
  );
}

export async function handlePositionWindow(
  step: PositionWindowStep,
  knownWindowId?: number,
): Promise<StepLog> {
  try {
    return isTerminalStep(step, knownWindowId)
      ? await positionTerminal(step, knownWindowId)
      : await positionGeneric(step);
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to position ${step.appName}: ${(error as Error).message}`,
    };
  }
}
