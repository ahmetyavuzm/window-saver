import type { Step, LogEntry } from '../../../shared/types.js';
import {
  runAppleScript,
  runShell,
  resolveProcessRef,
  resolveAppPid,
  toAppleScriptString,
  sleep,
} from '../applescript.js';
import { isYabaiAvailable, queryStandardWindowsByPid } from '../yabai.js';

type WaitForWindowStep = Extract<Step, { type: 'waitForWindow' }>;

const POLL_INTERVAL_MS = 300;
const DEFAULT_TIMEOUT_MS = 8000;
const REOPEN_AFTER_MS = 2000;

export async function handleWaitForWindow(
  step: WaitForWindowStep,
): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  const timeoutMs = step.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const escapedName = toAppleScriptString(step.appName);
  const useYabai = await isYabaiAvailable();

  const waitForRealWindow = async (deadline: number): Promise<boolean> => {
    // System Events only sees windows on VISIBLE Spaces. Activating switches
    // to the app's Space, making its window observable — and positionable.
    // (yabai counting doesn't need this, but the position step right after
    // this one does, so front the app either way.)
    try {
      await runAppleScript(`tell application "${escapedName}" to activate`);
    } catch {
      // app may still be starting; the polling below has time for it
    }

    const processRef = await resolveProcessRef(step.appName);
    const pid = useYabai ? await resolveAppPid(step.appName) : undefined;
    const start = Date.now();
    let reopenSent = false;

    while (Date.now() < deadline) {
      try {
        let count: number;
        if (useYabai && pid !== undefined) {
          // yabai sees hidden Spaces and never lists the phantom AX windows
          // System Events shows for activating apps (observed with Notes).
          count = (await queryStandardWindowsByPid(pid)).length;
        } else {
          // Only *standard* windows: the phantom windows lack that subrole.
          count = Number(
            await runAppleScript(
              `tell application "System Events" to count (every window of (${processRef}) whose subrole is "AXStandardWindow")`,
            ),
          );
        }
        if (count > 0) {
          return true;
        }

        // Still no window after a grace period: a running app whose windows
        // were all closed (Finder, Notes…) only *activates* on launch — send
        // `reopen` (what clicking the Dock icon does) so it opens its default
        // window.
        if (!reopenSent && Date.now() - start > REOPEN_AFTER_MS) {
          reopenSent = true;
          await runAppleScript(`tell application "${escapedName}" to reopen`);
        }
      } catch {
        // process may not have registered with System Events yet; keep polling
      }
      await sleep(POLL_INTERVAL_MS);
    }
    return false;
  };

  if (await waitForRealWindow(Date.now() + timeoutMs)) {
    return { status: 'ok', message: `${step.appName} has a window` };
  }

  // The app is running yet refuses to open any window no matter what — Notes
  // wedges itself into exactly this state. It has zero windows, so quitting
  // loses nothing, and a fresh launch reliably opens the default window again.
  try {
    await runAppleScript(`tell application "${escapedName}" to quit`);
    await sleep(1500);
    await runShell('open', ['-a', step.appName]);
  } catch {
    // couldn't relaunch (not scriptable / open failed) — fall through to error
  }
  if (await waitForRealWindow(Date.now() + timeoutMs)) {
    return {
      status: 'ok',
      message: `${step.appName} has a window (relaunched a stuck, windowless instance)`,
    };
  }

  return {
    status: 'error',
    message: `Timed out after ${timeoutMs * 2}ms waiting for ${step.appName} to open a window`,
  };
}
