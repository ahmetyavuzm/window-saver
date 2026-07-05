import type { Step } from '../../../shared/types.js';
import { runShell, runAppleScript, toAppleScriptString } from '../applescript.js';
import type { StepResult } from '../types.js';
import type { TrackedTarget } from '../registry.js';

type OpenUrlStep = Extract<Step, { type: 'openUrl' }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Best-effort: find a tab matching the URL in the browser's frontmost window
// when opening into an existing window/tab rather than a dedicated one.
// Only Chrome and Safari expose a scriptable tab list; other browsers (Arc,
// etc.) are skipped rather than risk closing the wrong window later.
async function resolveExistingTabTarget(browser: string, url: string): Promise<TrackedTarget | undefined> {
  const escapedUrl = toAppleScriptString(url);
  try {
    await sleep(300);
    if (browser === 'Google Chrome') {
      const result = await runAppleScript(`
        tell application "Google Chrome"
          set win to window 1
          set winId to id of win
          set tabIndex to 0
          repeat with i from 1 to (count of tabs of win)
            if (URL of tab i of win) contains "${escapedUrl}" then
              set tabIndex to i
              exit repeat
            end if
          end repeat
          return (winId as text) & "," & (tabIndex as text)
        end tell
      `);
      const [winIdStr, tabIndexStr] = result.split(',');
      const winId = parseInt(winIdStr, 10);
      const tabIndex = parseInt(tabIndexStr, 10);
      if (Number.isNaN(winId) || tabIndex <= 0) return undefined;
      return { kind: 'browserTab', label: url, browser, windowId: winId, tabIndex };
    }
    if (browser === 'Safari') {
      const result = await runAppleScript(`
        tell application "Safari"
          set win to window 1
          set winId to id of win
          set tabIndex to 0
          repeat with i from 1 to (count of tabs of win)
            if (URL of tab i of win) contains "${escapedUrl}" then
              set tabIndex to i
              exit repeat
            end if
          end repeat
          return (winId as text) & "," & (tabIndex as text)
        end tell
      `);
      const [winIdStr, tabIndexStr] = result.split(',');
      const winId = parseInt(winIdStr, 10);
      const tabIndex = parseInt(tabIndexStr, 10);
      if (Number.isNaN(winId) || tabIndex <= 0) return undefined;
      return { kind: 'browserTab', label: url, browser, windowId: winId, tabIndex };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function handleOpenUrl(step: OpenUrlStep): Promise<StepResult> {
  try {
    if (step.browser === 'default') {
      await runShell('open', [step.url]);
    } else if (step.newWindow && step.browser === 'Google Chrome') {
      await runShell('open', ['-na', 'Google Chrome', '--args', '--new-window', step.url]);
    } else if (step.newWindow) {
      await runShell('open', ['-na', step.browser, step.url]);
    } else {
      await runShell('open', ['-a', step.browser, step.url]);
    }

    let target: TrackedTarget | undefined;
    let untrackedNote: string | undefined;
    if (step.browser === 'default') {
      untrackedNote = 'not closeable via Close — "default browser" can\'t be targeted by AppleScript';
    } else {
      target = step.newWindow
        ? await resolveNewWindowTarget(step.browser, step.url)
        : await resolveExistingTabTarget(step.browser, step.url);
      if (!target) {
        untrackedNote = step.newWindow
          ? 'not closeable via Close — could not resolve the new window'
          : 'not closeable via Close — no matching tab found (only Chrome/Safari support tab matching)';
      }
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
