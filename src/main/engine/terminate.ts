import type { StopResultEntry } from '../../shared/types.js';
import type { TrackedTarget } from './registry.js';
import { runAppleScript, toAppleScriptString } from './applescript.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await sleep(200);
  }
  return !isProcessAlive(pid);
}

async function terminateProcess(target: Extract<TrackedTarget, { kind: 'process' }>): Promise<StopResultEntry> {
  if (!isProcessAlive(target.pid)) {
    return { label: target.label, closed: true, method: 'already exited' };
  }

  try {
    await runAppleScript(`tell application "${toAppleScriptString(target.label)}" to quit`);
  } catch {
    // app may not be scriptable; fall through to signals below
  }
  if (await waitForProcessExit(target.pid, 3000)) {
    return { label: target.label, closed: true, method: 'quit' };
  }

  try {
    process.kill(target.pid, 'SIGTERM');
  } catch {
    // process likely already gone
  }
  if (await waitForProcessExit(target.pid, 2000)) {
    return { label: target.label, closed: true, method: 'SIGTERM' };
  }

  try {
    process.kill(target.pid, 'SIGKILL');
  } catch {
    // process likely already gone
  }
  if (await waitForProcessExit(target.pid, 2000)) {
    return { label: target.label, closed: true, method: 'SIGKILL' };
  }

  return { label: target.label, closed: false, method: 'failed' };
}

async function terminateBrowserTab(target: Extract<TrackedTarget, { kind: 'browserTab' }>): Promise<StopResultEntry> {
  try {
    if (target.tabIndex !== undefined) {
      await runAppleScript(
        `tell application "${toAppleScriptString(target.browser)}" to close tab ${target.tabIndex} of window id ${target.windowId}`,
      );
      return { label: target.label, closed: true, method: 'close tab' };
    }
    await runAppleScript(`tell application "${toAppleScriptString(target.browser)}" to close window id ${target.windowId}`);
    return { label: target.label, closed: true, method: 'close window' };
  } catch (error) {
    return { label: target.label, closed: false, method: `error: ${(error as Error).message}` };
  }
}

async function isTerminalWindowOpen(windowId: number): Promise<boolean> {
  try {
    const result = await runAppleScript(`tell application "Terminal" to exists window id ${windowId}`);
    return result === 'true';
  } catch {
    return false;
  }
}

async function terminateTerminalWindow(
  target: Extract<TrackedTarget, { kind: 'terminalWindow' }>,
): Promise<StopResultEntry> {
  try {
    await runAppleScript(`tell application "Terminal" to close window id ${target.windowId}`);
  } catch {
    // Terminal shows a confirmation sheet ("Terminate running processes?")
    // instead of throwing when a process is still running inside the
    // window; dismiss it below so Close never hangs waiting on the user.
  }
  try {
    await runAppleScript(`
      tell application "System Events"
        tell process "Terminal"
          if exists sheet 1 of window 1 then
            click button "Terminate" of sheet 1 of window 1
          end if
        end tell
      end tell
    `);
  } catch {
    // no confirmation sheet present
  }
  await sleep(300);
  const stillOpen = await isTerminalWindowOpen(target.windowId);
  return { label: target.label, closed: !stillOpen, method: stillOpen ? 'failed' : 'close window' };
}

export async function terminateTarget(target: TrackedTarget): Promise<StopResultEntry> {
  if (target.kind === 'process') return terminateProcess(target);
  if (target.kind === 'browserTab') return terminateBrowserTab(target);
  return terminateTerminalWindow(target);
}
