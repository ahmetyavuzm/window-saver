import type { Profile, Step, LogEntry, RunResult } from '../../shared/types.js';
import { handleLaunchApp } from './handlers/launchApp.js';
import { handleWaitForWindow } from './handlers/waitForWindow.js';
import { handlePositionWindow } from './handlers/positionWindow.js';
import { handleOpenUrl } from './handlers/openUrl.js';
import { handleOpenTerminal } from './handlers/openTerminal.js';
import { handleWait } from './handlers/wait.js';
import * as registry from './registry.js';
import type { StepResult } from './types.js';

type Handler = (step: never) => Promise<StepResult>;

const handlers: Partial<Record<Step['type'], Handler>> = {
  launchApp: handleLaunchApp as Handler,
  waitForWindow: handleWaitForWindow as Handler,
  positionWindow: handlePositionWindow as Handler,
  openUrl: handleOpenUrl as Handler,
  openTerminal: handleOpenTerminal as Handler,
  wait: handleWait as Handler,
};

// launchApp/waitForWindow have nothing to run for if they fail; other step
// types default to letting the rest of the profile continue.
const ABORT_ON_FAILURE: Set<Step['type']> = new Set(['launchApp', 'waitForWindow']);

export async function runProfile(
  profile: Profile,
  onLog?: (entry: LogEntry) => void,
): Promise<RunResult> {
  const log: LogEntry[] = [];
  let ok = true;

  // A fresh run replaces whatever the previous run tracked — stale targets
  // from an unstopped earlier run would otherwise sit alongside new ones.
  registry.clear(profile.id);

  const emit = (entry: LogEntry) => {
    log.push(entry);
    onLog?.(entry);
  };

  for (const step of profile.steps) {
    const handler = handlers[step.type];
    if (!handler) {
      const entry: LogEntry = {
        stepId: step.id,
        status: 'error',
        message: `No handler registered for step type "${step.type}"`,
        timestamp: new Date().toISOString(),
      };
      emit(entry);
      ok = false;
      continue;
    }

    emit({ stepId: step.id, status: 'running', message: `Running ${step.type}`, timestamp: new Date().toISOString() });

    const result = await handler(step as never);
    if (result.meta?.target) {
      registry.track(profile.id, result.meta.target);
    }
    const { meta: _meta, ...logFields } = result;
    const entry: LogEntry = { stepId: step.id, timestamp: new Date().toISOString(), ...logFields };
    emit(entry);

    if (result.status === 'error') {
      ok = false;
      if (ABORT_ON_FAILURE.has(step.type)) {
        break;
      }
    }
  }

  return { profileId: profile.id, ok, log, hasTrackedTargets: registry.hasTracked(profile.id) };
}
