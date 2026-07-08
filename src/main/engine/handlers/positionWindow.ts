import { screen } from 'electron';
import type { Step, LogEntry } from '../../../shared/types.js';
import { runAppleScript, runJXA, resolveProcessRef, resolveAppPid, toAppleScriptString, sleep } from '../applescript.js';
import {
  isYabaiAvailable,
  resolveDisplaySpaceIndex,
  moveWindowToSpace,
  fullscreenWindowById,
  queryStandardWindowsByPid,
  queryWindowById,
  setWindowFrame,
  ensureSpacesOnDisplay,
  YABAI_MISSING_MESSAGE,
  type YabaiWindow,
} from '../yabai.js';
import { computeTargetBounds, resolveDisplayForPlacement, boundsFromNormalizedRect } from '../geometry.js';

type PositionWindowStep = Extract<Step, { type: 'positionWindow' }>;
type Bounds = { x: number; y: number; width: number; height: number };
type StepLog = Omit<LogEntry, 'stepId' | 'timestamp'>;

// A 'maximize' fullscreen box stays a normal, draggable window (it just fills
// the workArea), so it behaves like any placed window. Only *native* fullscreen
// gets macOS's own Space / title-bar-less treatment.
function isNativeFullscreen(step: PositionWindowStep): boolean {
  return step.fullscreen === true && step.fullscreenMode !== 'maximize';
}

// True when this step asks to move the window to a non-default desktop. Desktop
// 1 (or unset) means "leave it on the display's current Space" — no yabai move.
// Native fullscreen wins: such a window gets its OWN macOS Space automatically,
// so we never resolve/create a desktop for it (doing so is a no-op that also
// spuriously fails when the display has too few desktops). A maximize box is a
// regular window, so it CAN be moved to a desktop.
function wantsDesktopMove(step: PositionWindowStep): boolean {
  if (isNativeFullscreen(step)) return false;
  return step.desktopIndex !== undefined && step.desktopIndex > 1;
}

// Origin of the display this step targets — used to match the box's display to a
// yabai display (which numbers Spaces globally, per display) at run time.
function displayOriginForStep(step: PositionWindowStep): { x: number; y: number } {
  const display = step.placement
    ? resolveDisplayForPlacement(step.placement.display).display
    : screen.getPrimaryDisplay();
  return { x: display.bounds.x, y: display.bounds.y };
}

function notEnoughDesktopsMessage(desktopIndex: number): string {
  return (
    `Bu ekranda ${desktopIndex}. masaüstü yok ve otomatik oluşturulamadı. ` +
    'macOS, Space\'leri programla oluşturmaya yalnızca yabai\'nin scripting-addition\'ı ile ' +
    'izin verir; bu da kısmi SIP kapatma (Recovery > "csrutil disable") + "sudo yabai --load-sa" ' +
    'gerektirir. Bunları yapmadan masaüstünü Mission Control\'den (Ctrl+Yukarı Ok, sağ üstteki +) ' +
    'elle ekleyip tekrar deneyin.'
  );
}

// Resolves the box's per-display desktop to a global yabai Space, creating any
// missing real desktops first when possible. Creation is best-effort: it needs
// yabai's scripting-addition (which needs partial SIP off), so on locked-down
// machines this returns an actionable error instead of silently failing.
// Returns `created` so callers can re-focus their window afterwards, since
// creating Spaces changes which display/window yabai has focused.
async function resolveOrCreateDesktop(
  step: PositionWindowStep,
): Promise<{ space: number; created: number } | { error: string }> {
  const origin = displayOriginForStep(step);
  const target = step.desktopIndex!;

  let space = await resolveDisplaySpaceIndex(origin, target);
  if (space !== null) return { space, created: 0 };

  // Too few real desktops — try to create the missing ones.
  const res = await ensureSpacesOnDisplay(origin, target);
  if (res.needsScriptingAddition) return { error: notEnoughDesktopsMessage(target) };

  space = await resolveDisplaySpaceIndex(origin, target);
  if (space === null) return { error: notEnoughDesktopsMessage(target) };
  return { space, created: res.created };
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
// System Events refuses to move/resize Terminal windows (-10006), so Terminal
// is driven through its own scripting. Two Terminal quirks are handled here:
//
//  1. Set size before position — Terminal re-anchors the window on resize,
//     which would otherwise shift a just-set position back off target.
//  2. Terminal's `position` is relative to the *current display's* top-left,
//     not the global origin: physical screen Y = setY + currentDisplay.bounds.y.
//     With a display placed above the primary (negative bounds.y) this makes
//     "set position {x, 25}" land on the wrong screen. We read the window's
//     true on-screen bounds (CoreGraphics, global top-left coords matching
//     Electron's `screen`) to find which display it's on, then subtract that
//     display's bounds.y so an absolute Electron-space target lands correctly.
//     Terminal's AppleScript window id equals the window's CGWindowNumber, so
//     the CG lookup is exact.

async function readTerminalCGBounds(windowId: number): Promise<Bounds | null> {
  const jxa = `
    ObjC.import("CoreGraphics");
    function run() {
      var info = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, $.kCGNullWindowID);
      var n = $.CFArrayGetCount(info);
      for (var i = 0; i < n; i++) {
        var d = ObjC.castRefToObject($.CFArrayGetValueAtIndex(info, i));
        var num = d.objectForKey("kCGWindowNumber");
        if (num && num.intValue === ${windowId}) {
          var b = d.objectForKey("kCGWindowBounds");
          return [b.objectForKey("X").doubleValue, b.objectForKey("Y").doubleValue, b.objectForKey("Width").doubleValue, b.objectForKey("Height").doubleValue].join(",");
        }
      }
      return "NONE";
    }`;
  try {
    const r = await runJXA(jxa);
    if (r === 'NONE') return null;
    const [x, y, width, height] = r.split(',').map((n) => Math.round(parseFloat(n)));
    if ([x, y, width, height].some((v) => Number.isNaN(v))) return null;
    return { x, y, width, height };
  } catch {
    return null;
  }
}

// The Y offset to subtract from an absolute Electron-space target so Terminal's
// current-display-relative `set position` lands it there. 0 when the window's
// display starts at the global origin (the common single/side-by-side case).
async function terminalPositionOffsetY(windowId: number): Promise<number> {
  const cg = await readTerminalCGBounds(windowId);
  if (!cg) return 0;
  const display = screen.getDisplayNearestPoint({
    x: Math.round(cg.x + cg.width / 2),
    y: Math.round(cg.y + cg.height / 2),
  });
  return display.bounds.y;
}

async function positionTerminal(step: PositionWindowStep, knownWindowId?: number): Promise<StepLog> {
  // A concrete window id is required for the exact CoreGraphics lookup; fall
  // back to the front window's id when this step wasn't paired with openTerminal.
  let windowId = knownWindowId;
  if (windowId === undefined) {
    windowId = parseInt(await runAppleScript(`tell application "Terminal" to return id of front window`), 10);
  }
  if (Number.isNaN(windowId)) {
    return { status: 'error', message: 'Terminal has no window to position' };
  }
  const winRef = `window id ${windowId}`;

  if (wantsDesktopMove(step)) {
    if (!(await isYabaiAvailable())) {
      return { status: 'error', message: YABAI_MISSING_MESSAGE };
    }
    const resolved = await resolveOrCreateDesktop(step);
    if ('error' in resolved) {
      return { status: 'error', message: resolved.error };
    }
    // Terminal's AppleScript window id IS the CGWindowNumber yabai addresses,
    // so the window can be moved directly — no focus dance needed.
    await moveWindowToSpace(windowId, resolved.space);
    await sleep(300);
  }

  if (isNativeFullscreen(step)) {
    // System Events refuses to drive Terminal (-10006), so native fullscreen
    // goes through yabai.
    if (!(await isYabaiAvailable())) {
      return { status: 'error', message: `Fullscreen for Terminal needs yabai. ${YABAI_MISSING_MESSAGE}` };
    }
    await fullscreenWindowById(windowId);
    return successMessage(
      step,
      [wantsDesktopMove(step) ? `desktop ${step.desktopIndex}` : null],
      'fullscreen',
    );
  }

  const { bounds, actionLabel, fallbackReason } = await resolveTargetBounds(
    step,
    async () => (await readTerminalCGBounds(windowId!)) ?? { x: 0, y: 0, width: 0, height: 0 },
  );

  // Size first, then read the window's true display to correct the position
  // offset, then set position (see quirks note above).
  await runAppleScript(`tell application "Terminal" to set size of ${winRef} to {${bounds.width}, ${bounds.height}}`);
  await sleep(200);
  const offsetY = await terminalPositionOffsetY(windowId!);
  await runAppleScript(`tell application "Terminal" to set position of ${winRef} to {${bounds.x}, ${bounds.y - offsetY}}`);

  // Verify against the real on-screen frame (Terminal rounds to character
  // cells, hence the tolerance). Retry once with a freshly computed offset —
  // the first set may have moved the window to another display, changing it.
  const check = await readTerminalCGBounds(windowId!);
  if (check && !(Math.abs(check.x - bounds.x) <= 40 && Math.abs(check.y - bounds.y) <= 40)) {
    const offsetY2 = await terminalPositionOffsetY(windowId!);
    await runAppleScript(`tell application "Terminal" to set position of ${winRef} to {${bounds.x}, ${bounds.y - offsetY2}}`);
    const recheck = await readTerminalCGBounds(windowId!);
    if (recheck && !(Math.abs(recheck.x - bounds.x) <= 40 && Math.abs(recheck.y - bounds.y) <= 40)) {
      return {
        status: 'error',
        message:
          `Terminal window did not take the requested position: wanted ` +
          `{${bounds.x},${bounds.y}}, got {${recheck.x},${recheck.y}}`,
      };
    }
  }

  return successMessage(
    step,
    [wantsDesktopMove(step) ? `desktop ${step.desktopIndex}` : null, fallbackReason ?? null],
    actionLabel,
  );
}

// ---- Generic apps, yabai available: authoritative windowing -----------------
// yabai sees windows on hidden Spaces, never lists the phantom AX windows that
// fooled the System Events path (Notes), matches by PID (no process-name
// mismatch), and its move/resize works without the scripting-addition.

function yabaiFrameToBounds(w: YabaiWindow): Bounds {
  return {
    x: Math.round(w.frame.x),
    y: Math.round(w.frame.y),
    width: Math.round(w.frame.w),
    height: Math.round(w.frame.h),
  };
}

async function positionViaYabai(
  step: PositionWindowStep,
  knownWindowId?: number,
): Promise<StepLog> {
  let win: YabaiWindow;
  if (knownWindowId !== undefined) {
    // A grouped opener (openTerminal) captured this window's exact id, which
    // equals its yabai/CGWindowNumber id — position it directly, no app-wide
    // search. yabai moves/resizes Terminal windows fine (System Events can't,
    // hence Terminal's own AppleScript path is only the yabai-absent fallback).
    const found = await queryWindowById(knownWindowId);
    if (!found) {
      return { status: 'error', message: `${step.appName}'s window (id ${knownWindowId}) no longer exists` };
    }
    win = found;
  } else {
    // Activate first: brings the app's Space forward and its target window to
    // the front, mirroring what the user would see after a manual launch.
    await runAppleScript(`tell application "${toAppleScriptString(step.appName)}" to activate`);
    await sleep(300);

    const pid = await resolveAppPid(step.appName);
    if (pid === undefined) {
      return { status: 'error', message: `${step.appName} is not running — cannot position it` };
    }

    // Wait briefly for a real window: reopen/launch animations lag the activate.
    let candidates: YabaiWindow[] = [];
    const deadline = Date.now() + 4000;
    for (;;) {
      candidates = await queryStandardWindowsByPid(pid);
      if (step.windowTitle) {
        candidates = candidates.filter((w) => w.title.includes(step.windowTitle!));
      }
      if (candidates.length > 0) break;
      if (Date.now() > deadline) {
        return {
          status: 'error',
          message: `${step.appName} has no open window to position${step.windowTitle ? ` matching "${step.windowTitle}"` : ''}`,
        };
      }
      await sleep(300);
    }
    // Newest window (CGWindowNumbers increase) — the one this box just opened.
    win = candidates.reduce((a, b) => (a.id > b.id ? a : b));
  }

  if (wantsDesktopMove(step)) {
    const resolved = await resolveOrCreateDesktop(step);
    if ('error' in resolved) {
      return { status: 'error', message: resolved.error };
    }
    await moveWindowToSpace(win.id, resolved.space);
    await sleep(300);
  }

  if (isNativeFullscreen(step)) {
    // Native fullscreen creates its Space on whichever display the window is
    // currently on, ignoring the box's target display. Move it onto the target
    // display's workArea first so macOS fullscreens it on the right screen.
    if (step.placement) {
      const disp = resolveDisplayForPlacement(step.placement.display).display;
      await setWindowFrame(win.id, {
        x: disp.workArea.x,
        y: disp.workArea.y,
        width: disp.workArea.width,
        height: disp.workArea.height,
      });
      await sleep(300);
    }
    if (!(await fullscreenWindowById(win.id))) {
      return {
        status: 'error',
        message: `${step.appName}'s window did not enter fullscreen (a dialog/panel window can't be fullscreened)`,
      };
    }
    return successMessage(
      step,
      [
        step.windowTitle ? `window "${step.windowTitle}"` : null,
        wantsDesktopMove(step) ? `desktop ${step.desktopIndex}` : null,
      ],
      'fullscreen',
    );
  }

  const { bounds, actionLabel, fallbackReason } = await resolveTargetBounds(step, async () =>
    yabaiFrameToBounds(win),
  );

  await setWindowFrame(win.id, bounds);
  let after = await queryWindowById(win.id);
  if (!after || !boundsMatch(bounds, yabaiFrameToBounds(after))) {
    await sleep(300);
    await setWindowFrame(win.id, bounds);
    after = await queryWindowById(win.id);
  }
  if (!after) {
    return { status: 'error', message: `${step.appName}'s window disappeared while positioning it` };
  }
  if (!boundsMatch(bounds, yabaiFrameToBounds(after))) {
    const got = yabaiFrameToBounds(after);
    return {
      status: 'error',
      message:
        `${step.appName} did not take the requested frame: wanted ` +
        `{${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}}, got ` +
        `{${got.x},${got.y} ${got.width}x${got.height}} (app may enforce its own size)`,
    };
  }

  return successMessage(
    step,
    [
      step.windowTitle ? `window "${step.windowTitle}"` : null,
      wantsDesktopMove(step) ? `desktop ${step.desktopIndex}` : null,
      fallbackReason ?? null,
    ],
    actionLabel,
  );
}

// ---- Generic apps: System Events positioning --------------------------------
async function getWindowRef(appName: string, windowTitle?: string): Promise<string> {
  const processRef = await resolveProcessRef(appName);
  // Restrict to standard windows: activating apps can expose transient/phantom
  // AX windows (observed with Notes) that accept `set position` yet never
  // appear on screen — "window 1" happily targeted those.
  return windowTitle
    ? `first window of (${processRef}) whose name contains "${toAppleScriptString(windowTitle)}"`
    : `first window of (${processRef}) whose subrole is "AXStandardWindow"`;
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

// System Events reports success even when the app clamps or ignores the
// request (fixed-size windows, min sizes, cross-display quirks), so read the
// frame back and compare. One retry: the first set can land while the window
// is still animating open.
const BOUNDS_TOLERANCE_PX = 40;

function boundsMatch(a: Bounds, b: Bounds): boolean {
  return (
    Math.abs(a.x - b.x) <= BOUNDS_TOLERANCE_PX &&
    Math.abs(a.y - b.y) <= BOUNDS_TOLERANCE_PX &&
    Math.abs(a.width - b.width) <= BOUNDS_TOLERANCE_PX &&
    Math.abs(a.height - b.height) <= BOUNDS_TOLERANCE_PX
  );
}

async function setAndVerifyWindowBounds(
  windowRef: string,
  bounds: Bounds,
): Promise<{ applied: boolean; actual: Bounds }> {
  await setWindowBounds(windowRef, bounds);
  let actual = await getWindowBounds(windowRef);
  if (boundsMatch(bounds, actual)) return { applied: true, actual };

  await sleep(300);
  await setWindowBounds(windowRef, bounds);
  actual = await getWindowBounds(windowRef);
  return { applied: boundsMatch(bounds, actual), actual };
}

// Put a window into native (macOS) fullscreen via the accessibility API. This
// is a different AX attribute from move/resize, so it works for most apps even
// where precise positioning is finicky.
async function setNativeFullscreen(windowRef: string): Promise<void> {
  await runAppleScript(`
    tell application "System Events"
      set value of attribute "AXFullScreen" of (${windowRef}) to true
    end tell
  `);
}

async function positionGeneric(step: PositionWindowStep): Promise<StepLog> {
  // "activate" reliably brings the app to the actual OS-level front. System
  // Events' "set frontmost of process to true" can silently fail to stick
  // (observed with Chrome), leaving us acting on the wrong window even
  // though this step would otherwise report success. Activating also switches
  // to the window's Space when it lives on a hidden desktop — System Events
  // cannot see (let alone move) windows on non-visible Spaces.
  await runAppleScript(`tell application "${toAppleScriptString(step.appName)}" to activate`);
  await sleep(300);

  const windowRef = await getWindowRef(step.appName, step.windowTitle);

  // The Space-switch/open animation can lag the activate; give the window a
  // moment to become observable before failing the whole step.
  const refDeadline = Date.now() + 3000;
  for (;;) {
    try {
      await getWindowBounds(windowRef);
      break;
    } catch (err) {
      if (Date.now() > refDeadline) {
        return {
          status: 'error',
          message: `${step.appName} has no on-screen window to position (is it open on a hidden Space or without windows?)`,
        };
      }
      await sleep(300);
    }
  }

  if (step.windowTitle) {
    await runAppleScript(`
      tell application "System Events"
        perform action "AXRaise" of (${windowRef})
      end tell
    `);
    await sleep(200);
  }

  // This path only runs when yabai is absent (positionViaYabai handles the
  // rest), and desktop moves are impossible without it.
  if (wantsDesktopMove(step)) {
    return { status: 'error', message: YABAI_MISSING_MESSAGE };
  }

  if (isNativeFullscreen(step)) {
    await setNativeFullscreen(windowRef);
    return successMessage(
      step,
      [
        step.windowTitle ? `window "${step.windowTitle}"` : null,
        wantsDesktopMove(step) ? `desktop ${step.desktopIndex}` : null,
      ],
      'fullscreen',
    );
  }

  const { bounds, actionLabel, fallbackReason } = await resolveTargetBounds(step, () => getWindowBounds(windowRef));
  const { applied, actual } = await setAndVerifyWindowBounds(windowRef, bounds);
  if (!applied) {
    return {
      status: 'error',
      message:
        `${step.appName} did not take the requested frame: wanted ` +
        `{${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}}, got ` +
        `{${actual.x},${actual.y} ${actual.width}x${actual.height}} ` +
        `(app may enforce its own size, or the window is on another Space)`,
    };
  }

  return successMessage(
    step,
    [
      step.windowTitle ? `window "${step.windowTitle}"` : null,
      wantsDesktopMove(step) ? `desktop ${step.desktopIndex}` : null,
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
    // Prefer yabai when present: it positions every app — Terminal included —
    // by window id, without System Events' -10006 refusal or Terminal's
    // display-relative coordinate quirks. Without yabai, Terminal needs its own
    // AppleScript path and other apps fall back to System Events.
    if (await isYabaiAvailable()) {
      return await positionViaYabai(step, knownWindowId);
    }
    if (isTerminalStep(step, knownWindowId)) {
      return await positionTerminal(step, knownWindowId);
    }
    return await positionGeneric(step);
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to position ${step.appName}: ${(error as Error).message}`,
    };
  }
}
