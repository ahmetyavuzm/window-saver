import type { Step } from '../../../shared/types.js';
import { runShell, resolveAppPid } from '../applescript.js';
import type { StepResult } from '../types.js';

type LaunchAppStep = Extract<Step, { type: 'launchApp' }>;

export async function handleLaunchApp(step: LaunchAppStep): Promise<StepResult> {
  try {
    // `-n` forces a new instance/window even if the app is already running;
    // without it `open` just activates the running app (positionWindow then
    // re-uses that window). Making sure a window actually appears (reopen for
    // windowless running apps, hidden-Space handling) is waitForWindow's job.
    const args = [
      ...(step.openNewWindow ? ['-n'] : []),
      ...(step.bundleId ? ['-b', step.bundleId] : ['-a', step.appName]),
    ];
    await runShell('open', args);
    const pid = await resolveAppPid(step.appName);
    return {
      status: 'ok',
      message: `Launched ${step.appName}`,
      meta: pid !== undefined ? { target: { kind: 'process', label: step.appName, pid } } : undefined,
    };
  } catch (error) {
    return { status: 'error', message: `Failed to launch ${step.appName}: ${(error as Error).message}` };
  }
}
