import type { Step } from '../../../shared/types.js';
import { runAppleScript, toAppleScriptString } from '../applescript.js';
import type { StepResult } from '../types.js';

type OpenTerminalStep = Extract<Step, { type: 'openTerminal' }>;

export async function handleOpenTerminal(step: OpenTerminalStep): Promise<StepResult> {
  try {
    const shellCommand = step.command
      ? `cd "${step.cwd}" && ${step.command}`
      : `cd "${step.cwd}"`;
    // Terminal makes the new window from `do script` frontmost immediately,
    // so capturing "window 1" right after is reliable for Close/Stop tracking.
    const script = `
      tell application "Terminal"
        do script "${toAppleScriptString(shellCommand)}"
        return id of window 1
      end tell
    `;
    const result = await runAppleScript(script);
    const windowId = parseInt(result, 10);
    return {
      status: 'ok',
      message: `Opened Terminal in ${step.cwd}${step.command ? ` running "${step.command}"` : ''}`,
      meta: !Number.isNaN(windowId)
        ? { target: { kind: 'terminalWindow', label: `Terminal: ${step.cwd}`, windowId } }
        : undefined,
    };
  } catch (error) {
    return { status: 'error', message: `Failed to open Terminal: ${(error as Error).message}` };
  }
}
