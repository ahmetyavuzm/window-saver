import type { Step, LogEntry } from '../../../shared/types.js';

type WaitStep = Extract<Step, { type: 'wait' }>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleWait(step: WaitStep): Promise<Omit<LogEntry, 'stepId' | 'timestamp'>> {
  await sleep(step.ms);
  return { status: 'ok', message: `Waited ${step.ms}ms` };
}
