import type { LogEntry } from '../../shared/types.js';
import type { TrackedTarget } from './registry.js';

// meta is consumed by runner.ts to feed the Close/Stop registry and is
// stripped before the entry is emitted as a LogEntry — it never reaches the
// renderer.
export type StepResult = Omit<LogEntry, 'stepId' | 'timestamp'> & {
  meta?: { target?: TrackedTarget };
};
