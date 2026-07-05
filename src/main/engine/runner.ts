import type { Profile, Step, LogEntry, RunResult } from '../../shared/types.js';
import { handleLaunchApp } from './handlers/launchApp.js';
import { handleWaitForWindow } from './handlers/waitForWindow.js';
import { handlePositionWindow } from './handlers/positionWindow.js';

type StepResult = Omit<LogEntry, 'stepId' | 'timestamp'>;
type Handler = (step: never) => Promise<StepResult>;

const handlers: Partial<Record<Step['type'], Handler>> = {
  launchApp: handleLaunchApp as Handler,
  waitForWindow: handleWaitForWindow as Handler,
  positionWindow: handlePositionWindow as Handler,
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
    const entry: LogEntry = { stepId: step.id, timestamp: new Date().toISOString(), ...result };
    emit(entry);

    if (result.status === 'error') {
      ok = false;
      if (ABORT_ON_FAILURE.has(step.type)) {
        break;
      }
    }
  }

  return { profileId: profile.id, ok, log };
}
