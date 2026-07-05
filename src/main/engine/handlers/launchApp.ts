import type { Step, LogEntry } from '../../../shared/types.js';
import { runShell } from '../applescript.js';

type LaunchAppStep = Extract<Step, { type: 'launchApp' }>;

export async function handleLaunchApp(step: LaunchAppStep): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  try {
    const args = step.bundleId ? ['-b', step.bundleId] : ['-a', step.appName];
    if (step.args?.length) args.push('--args', ...step.args);
    await runShell('open', args);
    return { status: 'ok', message: `Launched ${step.appName}` };
  } catch (error) {
    return { status: 'error', message: `Failed to launch ${step.appName}: ${(error as Error).message}` };
  }
}
