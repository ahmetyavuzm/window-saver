import type { Step, LogEntry } from '../../../shared/types.js';
import { runShell, runAppleScript, resolveProcessRef } from '../applescript.js';
import type { StepResult } from '../types.js';

type LaunchAppStep = Extract<Step, { type: 'launchApp' }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Best-effort PID resolution for Close/Stop tracking — a failure here never
// fails the launch itself, it just means this app won't be closeable later.
async function resolvePid(appName: string, timeoutMs = 4000): Promise<number | undefined> {
  const processRef = await resolveProcessRef(appName);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await runAppleScript(`tell application "System Events" to unix id of (${processRef})`);
      const pid = parseInt(result, 10);
      if (!Number.isNaN(pid)) return pid;
    } catch {
      // process may not have registered with System Events yet; keep polling
    }
    await sleep(200);
  }
  return undefined;
}

export async function handleLaunchApp(step: LaunchAppStep): Promise<StepResult> {
  try {
    const args = step.bundleId ? ['-b', step.bundleId] : ['-a', step.appName];
    if (step.args?.length) args.push('--args', ...step.args);
    await runShell('open', args);
    const pid = await resolvePid(step.appName);
    return {
      status: 'ok',
      message: `Launched ${step.appName}`,
      meta: pid !== undefined ? { target: { kind: 'process', label: step.appName, pid } } : undefined,
    };
  } catch (error) {
    return { status: 'error', message: `Failed to launch ${step.appName}: ${(error as Error).message}` };
  }
}
