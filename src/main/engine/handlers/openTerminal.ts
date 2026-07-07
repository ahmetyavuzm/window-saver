import type { Step } from '../../../shared/types.js';
import { runAppleScript, toAppleScriptString } from '../applescript.js';
import type { StepResult } from '../types.js';

type OpenTerminalStep = Extract<Step, { type: 'openTerminal' }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Terminal's window title starts as a placeholder (e.g. "Terminal — -zsh —
// 80×24") and keeps changing as the shell starts up and prints its first
// prompt — capturing it too early gives a title that no longer matches by
// the time a later positionWindow step looks the window up via System
// Events. A shell's rc file can also run something (e.g. a `tail` of a log)
// that holds the title on an intermediate value for multiple poll intervals
// in a row before the final prompt title appears — two consecutive matches
// isn't enough confirmation that it's actually settled, so this requires
// three in a row, polled by Terminal's own window id (stable, same
// AppleScript namespace), before giving up and using whatever was last read.
async function waitForStableTitle(windowId: number): Promise<string> {
  let previous: string | undefined;
  let matchStreak = 0;
  for (let i = 0; i < 15; i++) {
    const current = await runAppleScript(`
      tell application "Terminal"
        return name of window id ${windowId}
      end tell
    `);
    if (current === previous) {
      matchStreak++;
      if (matchStreak >= 3) return current;
    } else {
      matchStreak = 0;
    }
    previous = current;
    await sleep(200);
  }
  return previous ?? '';
}

export async function handleOpenTerminal(step: OpenTerminalStep): Promise<StepResult> {
  try {
    const shellCommand = step.command
      ? `cd "${step.cwd}" && ${step.command}`
      : `cd "${step.cwd}"`;
    // "window 1" (frontmost) right after `do script` looks reliable, but isn't:
    // when a profile runs a second openTerminal in quick succession, Terminal's
    // frontmost bookkeeping can still lag behind, so "window 1" ends up being
    // some unrelated pre-existing window instead of the one `do script` just
    // created — the follow-up positionWindow step then title-matches against
    // the wrong window entirely. Diffing window ids before/after `do script`
    // identifies the new window unambiguously regardless of frontmost order.
    const idScript = `
      tell application "Terminal"
        set beforeIds to id of every window
        do script "${toAppleScriptString(shellCommand)}"
        set afterIds to id of every window
        set newId to 0
        repeat with anId in afterIds
          if beforeIds does not contain (contents of anId) then
            set newId to (contents of anId)
            exit repeat
          end if
        end repeat
        return newId
      end tell
    `;
    const idResult = await runAppleScript(idScript);
    const windowId = parseInt(idResult, 10) || NaN;
    // The settled title is used by a later grouped positionWindow step to
    // find the right window via System Events, since System Events window
    // elements have no `id` property Terminal's own window id could map to.
    const windowTitle = !Number.isNaN(windowId) ? await waitForStableTitle(windowId) : '';
    return {
      status: 'ok',
      message: `Opened Terminal in ${step.cwd}${step.command ? ` running "${step.command}"` : ''}`,
      meta: {
        target: !Number.isNaN(windowId)
          ? { kind: 'terminalWindow', label: `Terminal: ${step.cwd}`, windowId }
          : undefined,
        windowTitleHint: windowTitle || undefined,
      },
    };
  } catch (error) {
    return { status: 'error', message: `Failed to open Terminal: ${(error as Error).message}` };
  }
}
