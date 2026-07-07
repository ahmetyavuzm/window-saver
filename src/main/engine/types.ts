import type { LogEntry } from '../../shared/types.js';
import type { TrackedTarget } from './registry.js';

// meta is consumed by runner.ts to feed the Close/Stop registry and is
// stripped before the entry is emitted as a LogEntry — it never reaches the
// renderer.
export type StepResult = Omit<LogEntry, 'stepId' | 'timestamp'> & {
  // windowIdHint lets openTerminal tell a later positionWindow step in the
  // same group exactly which Terminal window it opened. Terminal is positioned
  // through its own AppleScript (`position`/`size` by `window id`), which is
  // reliable where System Events is not (System Events refuses to move/resize
  // Terminal windows, -10006), so the numeric id is exactly what's needed.
  meta?: { target?: TrackedTarget; windowIdHint?: number };
};
