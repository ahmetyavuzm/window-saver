import type { Step } from '../../../shared/types.js';
import { runAppleScript, toAppleScriptString } from '../applescript.js';
import type { StepResult } from '../types.js';

type OpenTerminalStep = Extract<Step, { type: 'openTerminal' }>;

export async function handleOpenTerminal(step: OpenTerminalStep): Promise<StepResult> {
  try {
    const shellCommand = step.command
      ? `cd "${step.cwd}" && ${step.command}`
      : `cd "${step.cwd}"`;
    // "window 1" (frontmost) right after `do script` looks reliable, but isn't:
    // when a profile runs a second openTerminal in quick succession, Terminal's
    // frontmost bookkeeping can still lag behind, so "window 1" ends up being
    // some unrelated pre-existing window instead of the one `do script` just
    // created. Diffing window ids before/after `do script` identifies the new
    // window unambiguously regardless of frontmost order. That id is stable and
    // is what the grouped positionWindow step uses to place the window via
    // Terminal's own AppleScript.
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
    const windowId = parseInt(idResult, 10);
    const hasId = !Number.isNaN(windowId) && windowId !== 0;
    return {
      status: 'ok',
      message: `Opened Terminal in ${step.cwd}${step.command ? ` running "${step.command}"` : ''}`,
      meta: {
        target: hasId ? { kind: 'terminalWindow', label: `Terminal: ${step.cwd}`, windowId } : undefined,
        windowIdHint: hasId ? windowId : undefined,
      },
    };
  } catch (error) {
    return { status: 'error', message: `Failed to open Terminal: ${(error as Error).message}` };
  }
}
