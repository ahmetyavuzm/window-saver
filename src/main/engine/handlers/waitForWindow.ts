import type { Step, LogEntry } from '../../../shared/types.js';
import { runAppleScript, toAppleScriptString } from '../applescript.js';

type WaitForWindowStep = Extract<Step, { type: 'waitForWindow' }>;

const POLL_INTERVAL_MS = 300;
const DEFAULT_TIMEOUT_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleWaitForWindow(
  step: WaitForWindowStep,
): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  const appName = toAppleScriptString(step.appName);
  const timeoutMs = step.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const script = `tell application "System Events" to count (every window of process "${appName}")`;
      const result = await runAppleScript(script);
      if (Number(result) > 0) {
        return { status: 'ok', message: `${step.appName} has a window` };
      }
    } catch {
      // process may not have registered with System Events yet; keep polling
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return {
    status: 'error',
    message: `Timed out after ${timeoutMs}ms waiting for ${step.appName} to open a window`,
  };
}
