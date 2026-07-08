import type { BoxAction } from '../../../shared/types.js';
import { runShell, runAppleScript, sleep } from '../applescript.js';
import type { StepResult } from '../types.js';

// appName comes from the containing box's positionWindow step, not the
// action itself — every openTarget action in a box targets the same app.
export async function runBoxAction(action: BoxAction, appName: string): Promise<StepResult> {
  try {
    if (action.kind === 'wait') {
      await sleep(action.ms);
      return { status: 'ok', message: `Waited ${action.ms}ms` };
    }
    if (action.kind === 'appleScript') {
      await runAppleScript(action.script);
      return { status: 'ok', message: `Ran: ${action.label}` };
    }
    await runShell('open', ['-a', appName, action.value]);
    return { status: 'ok', message: `Ran: ${action.label}` };
  } catch (error) {
    return { status: 'error', message: `Action "${action.label}" failed: ${(error as Error).message}` };
  }
}
