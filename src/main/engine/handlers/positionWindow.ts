import type { Step, LogEntry } from '../../../shared/types.js';
import { runAppleScript, runShell, toAppleScriptString } from '../applescript.js';

type PositionWindowStep = Extract<Step, { type: 'positionWindow' }>;

export async function handlePositionWindow(
  step: PositionWindowStep,
): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  try {
    const appName = toAppleScriptString(step.appName);
    await runAppleScript(
      `tell application "System Events" to set frontmost of process "${appName}" to true`,
    );
    await runShell('open', [`rectangle://execute-action?name=${step.rectangleAction}`]);
    return { status: 'ok', message: `Positioned ${step.appName} (${step.rectangleAction})` };
  } catch (error) {
    return {
      status: 'error',
      message: `Failed to position ${step.appName}: ${(error as Error).message}`,
    };
  }
}
