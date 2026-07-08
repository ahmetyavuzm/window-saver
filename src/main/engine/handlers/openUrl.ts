import type { Step } from '../../../shared/types.js';
import { runShell, runAppleScript, toAppleScriptString, sleep } from '../applescript.js';
import type { StepResult } from '../types.js';
import type { TrackedTarget } from '../registry.js';

type OpenUrlStep = Extract<Step, { type: 'openUrl' }>;

// "default" browser can't be targeted by name in AppleScript, so a dedicated
// window opened that way can't be tracked for Close/Stop — best-effort only.
async function resolveNewWindowTarget(browser: string, url: string): Promise<TrackedTarget | undefined> {
  try {
    await sleep(300);
    const windowId = await runAppleScript(`tell application "${toAppleScriptString(browser)}" to id of window 1`);
    const id = parseInt(windowId, 10);
    if (Number.isNaN(id)) return undefined;
    return { kind: 'browserTab', label: url, browser, windowId: id };
  } catch {
    return undefined;
  }
}

// Tab mode: create the tab directly in the browser's NEWEST window (highest
// window id) via AppleScript, and return that exact window + tab for tracking.
// `open -a <browser> <url>` instead dispatches to the browser's last-active
// (MRU) window — and the `activate` in the preceding wait/position steps fronts
// an OLD window, so tabs landed there instead of the window this workspace just
// opened. Only Chrome and Safari are scriptable this way; Arc etc. fall back to
// `open -a`. Returns undefined (→ caller falls back) if the browser has no
// window yet.
async function openTabInNewestWindow(browser: string, url: string): Promise<TrackedTarget | undefined> {
  try {
    const result = await runAppleScript(`
      tell application "${browser}"
        if (count of windows) is 0 then return "NONE"
        set targetWin to item 1 of windows
        set maxId to id of targetWin
        repeat with w in windows
          if (id of w) > maxId then
            set maxId to id of w
            set targetWin to w
          end if
        end repeat
        tell targetWin to make new tab with properties {URL:"${toAppleScriptString(url)}"}
        return (id of targetWin as text) & "," & (count of tabs of targetWin as text)
      end tell
    `);
    if (result.trim() === 'NONE') return undefined;
    const [winIdStr, tabIndexStr] = result.split(',');
    const winId = parseInt(winIdStr, 10);
    const tabIndex = parseInt(tabIndexStr, 10);
    if (Number.isNaN(winId) || tabIndex <= 0) return undefined;
    return { kind: 'browserTab', label: url, browser, windowId: winId, tabIndex };
  } catch {
    return undefined;
  }
}

export async function handleOpenUrl(step: OpenUrlStep): Promise<StepResult> {
  try {
    // Tab into an existing window on a scriptable browser: target the newest
    // window explicitly (see openTabInNewestWindow) rather than letting
    // `open -a` pick the MRU window.
    if (!step.newWindow && (step.browser === 'Google Chrome' || step.browser === 'Safari')) {
      const target = await openTabInNewestWindow(step.browser, step.url);
      if (target) {
        return { status: 'ok', message: `Opened ${step.url} in ${step.browser}`, meta: { target } };
      }
      // Browser had no window to tab into — plain open launches it and opens the
      // URL (can't resolve a tracked tab in that case).
      await runShell('open', ['-a', step.browser, step.url]);
      return {
        status: 'ok',
        message: `Opened ${step.url} in ${step.browser} (not closeable via Close — no window to tab into)`,
      };
    }

    if (step.browser === 'default') {
      await runShell('open', [step.url]);
    } else if (step.newWindow && step.browser === 'Google Chrome') {
      await runShell('open', ['-na', 'Google Chrome', '--args', '--new-window', step.url]);
    } else if (step.newWindow) {
      await runShell('open', ['-na', step.browser, step.url]);
    } else {
      // Non-scriptable tab (Arc): best-effort, no tab tracking.
      await runShell('open', ['-a', step.browser, step.url]);
    }

    let target: TrackedTarget | undefined;
    let untrackedNote: string | undefined;
    if (step.browser === 'default') {
      untrackedNote = 'not closeable via Close — "default browser" can\'t be targeted by AppleScript';
    } else if (step.newWindow) {
      target = await resolveNewWindowTarget(step.browser, step.url);
      if (!target) untrackedNote = 'not closeable via Close — could not resolve the new window';
    } else {
      untrackedNote = 'not closeable via Close — tab tracking only supports Chrome/Safari';
    }

    return {
      status: 'ok',
      message: `Opened ${step.url} in ${step.browser}${untrackedNote ? ` (${untrackedNote})` : ''}`,
      meta: target ? { target } : undefined,
    };
  } catch (error) {
    return { status: 'error', message: `Failed to open ${step.url}: ${(error as Error).message}` };
  }
}
