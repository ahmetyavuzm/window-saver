import type { Step, LogEntry } from '../../../shared/types.js';
import { sleep } from '../applescript.js';

type WaitStep = Extract<Step, { type: 'wait' }>;

export async function handleWait(step: WaitStep): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  await sleep(step.ms);
  return { status: 'ok', message: `Waited ${step.ms}ms` };
}
