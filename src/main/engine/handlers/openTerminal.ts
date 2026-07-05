import type { Step, LogEntry } from '../../../shared/types.js';
import { runAppleScript, toAppleScriptString } from '../applescript.js';

type OpenTerminalStep = Extract<Step, { type: 'openTerminal' }>;

export async function handleOpenTerminal(
  step: OpenTerminalStep,
): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  try {
    const shellCommand = step.command
      ? `cd "${step.cwd}" && ${step.command}`
      : `cd "${step.cwd}"`;
    const script = `tell application "Terminal" to do script "${toAppleScriptString(shellCommand)}"`;
    await runAppleScript(script);
    return { status: 'ok', message: `Opened Terminal in ${step.cwd}${step.command ? ` running "${step.command}"` : ''}` };
  } catch (error) {
    return { status: 'error', message: `Failed to open Terminal: ${(error as Error).message}` };
  }
}
