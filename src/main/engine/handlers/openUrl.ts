import type { Step, LogEntry } from '../../../shared/types.js';
import { runShell } from '../applescript.js';

type OpenUrlStep = Extract<Step, { type: 'openUrl' }>;

export async function handleOpenUrl(step: OpenUrlStep): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
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
    return { status: 'ok', message: `Opened ${step.url} in ${step.browser}` };
  } catch (error) {
    return { status: 'error', message: `Failed to open ${step.url}: ${(error as Error).message}` };
  }
}
