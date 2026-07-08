import type { Step } from '../../../shared/types.js';
import { runShell, runAppleScript, resolveAppPid } from '../applescript.js';
import type { StepResult } from '../types.js';

type LaunchAppStep = Extract<Step, { type: 'launchApp' }>;

export async function handleLaunchApp(step: LaunchAppStep): Promise<StepResult> {
  try {
    if (step.openNewWindow && step.appName === 'Google Chrome' && (await resolveAppPid('Google Chrome')) !== undefined) {
      // Chrome's `open -n` is async: the new window appears ~0.8s AFTER `open`
      // returns, but positionWindow only waits ~300ms then grabs the "newest"
      // window — so it races onto an OLD window and the real new one opens later
      // unmanaged. Two such boxes then both drop onto Chrome's default cascade
      // and overlap, looking like a single window. `make new window` creates it
      // synchronously, so it's already the newest window when positioning runs.
      // (Only when Chrome is already running; otherwise the launch below opens
      // its first window itself.)
      await runAppleScript('tell application "Google Chrome"\n  activate\n  make new window\nend tell');
    } else {
      // `-n` forces a new instance/window even if the app is already running;
      // without it `open` just activates the running app (positionWindow then
      // re-uses that window). Making sure a window actually appears (reopen for
      // windowless running apps, hidden-Space handling) is waitForWindow's job.
      const args = [
        ...(step.openNewWindow ? ['-n'] : []),
        ...(step.bundleId ? ['-b', step.bundleId] : ['-a', step.appName]),
      ];
      await runShell('open', args);
    }
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
