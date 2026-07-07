import type { LogEntry } from '../../shared/types.js';
import type { TrackedTarget } from './registry.js';

// meta is consumed by runner.ts to feed the Close/Stop registry and is
// stripped before the entry is emitted as a LogEntry — it never reaches the
// renderer.
export type StepResult = Omit<LogEntry, 'stepId' | 'timestamp'> & {
  // windowTitleHint lets a launch-like step (currently just openTerminal) tell
  // a later positionWindow step in the same group exactly which OS window it
  // opened, via title match — System Events UI-element windows have no `id`
  // property, so a captured numeric id (e.g. Terminal's own AppleScript
  // window id) can't be used as a System Events window reference.
  meta?: { target?: TrackedTarget; windowTitleHint?: string };
};
