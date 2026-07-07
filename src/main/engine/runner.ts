import type { Profile, Step, LogEntry, RunResult } from '../../shared/types.js';
import { handleLaunchApp } from './handlers/launchApp.js';
import { handleWaitForWindow } from './handlers/waitForWindow.js';
import { handlePositionWindow } from './handlers/positionWindow.js';
import { handleOpenUrl } from './handlers/openUrl.js';
import { handleOpenTerminal } from './handlers/openTerminal.js';
import { handleWait } from './handlers/wait.js';
import { runBoxAction } from './handlers/runAction.js';
import { createDesktopViaMissionControl } from './missioncontrol.js';
import * as registry from './registry.js';
import type { StepResult } from './types.js';

type Handler = (step: never) => Promise<StepResult>;

const handlers: Partial<Record<Step['type'], Handler>> = {
  launchApp: handleLaunchApp as Handler,
  waitForWindow: handleWaitForWindow as Handler,
  openUrl: handleOpenUrl as Handler,
  openTerminal: handleOpenTerminal as Handler,
  wait: handleWait as Handler,
};

// launchApp/waitForWindow have nothing to run for if they fail; other step
// types default to letting the rest of the profile continue.
const ABORT_ON_FAILURE: Set<Step['type']> = new Set(['launchApp', 'waitForWindow']);

// Does this profile open at least one *windowed* (non native-fullscreen) window?
// A native-fullscreen app gets its OWN macOS Space automatically, so it never
// lands on the "clean slate" desktop that 'createNew' adds. If every window in
// the profile is fullscreen, that new desktop would just be an empty orphan
// (created on whichever display Mission Control shows), so the caller skips it.
function hasWindowedTarget(profile: Profile): boolean {
  // Only *native* fullscreen takes its own Space; a 'maximize' box stays a
  // normal window that lands on (and benefits from) the fresh desktop.
  const isNativeFullscreen = (s: Step): boolean =>
    s.type === 'positionWindow' && s.fullscreen === true && s.fullscreenMode !== 'maximize';

  const nativeFullscreenGroups = new Set<string>();
  for (const s of profile.steps) {
    if (isNativeFullscreen(s) && 'groupId' in s && s.groupId) nativeFullscreenGroups.add(s.groupId);
  }
  for (const s of profile.steps) {
    // Any placement that isn't native fullscreen is a windowed target.
    if (s.type === 'positionWindow' && !isNativeFullscreen(s)) return true;
    // A launched app / terminal / opened URL is windowed unless its group is native fullscreen.
    if (s.type === 'launchApp' || s.type === 'openTerminal' || s.type === 'openUrl') {
      if (!s.groupId || !nativeFullscreenGroups.has(s.groupId)) return true;
    }
  }
  return false;
}

export async function runProfile(
  profile: Profile,
  options?: { createNewDesktop?: boolean },
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

  // desktopMode 'createNew': add a fresh desktop (Mission Control "+") before
  // anything launches, so the workspace gets a clean slate. Best-effort and
  // SIP-free; failure is logged but never aborts the run. Skipped when every
  // window is fullscreen (each already gets its own Space — a new desktop would
  // just be an empty orphan on some display).
  if (options?.createNewDesktop && hasWindowedTarget(profile)) {
    const res = await createDesktopViaMissionControl();
    emit({
      stepId: 'desktop',
      status: res.created ? 'ok' : 'error',
      message: res.created
        ? 'Yeni masaüstü oluşturuldu (Mission Control). Pencereleri sürükleyerek yerleştirebilirsiniz.'
        : `Yeni masaüstü oluşturulamadı: ${res.error ?? 'bilinmeyen hata'}`,
      timestamp: new Date().toISOString(),
    });
  }

  // A grouped openTerminal step captures the exact id of the Terminal window it
  // opened; the group's positionWindow step reuses that id to place precisely
  // the right window via Terminal's own AppleScript, rather than guessing
  // "window 1" (which is only frontmost-at-call-time and can be a stale window).
  const windowIdByGroup = new Map<string, number>();

  for (const step of profile.steps) {
    if (step.type === 'positionWindow') {
      const knownWindowId = step.groupId ? windowIdByGroup.get(step.groupId) : undefined;
      emit({ stepId: step.id, status: 'running', message: `Running ${step.type}`, timestamp: new Date().toISOString() });
      const result = await handlePositionWindow(step, knownWindowId);
      const entry: LogEntry = { stepId: step.id, timestamp: new Date().toISOString(), ...result };
      emit(entry);
      if (result.status === 'error') ok = false;

      for (const action of step.actions ?? []) {
        emit({ stepId: action.id, status: 'running', message: `Running action: ${action.label}`, timestamp: new Date().toISOString() });
        const actionResult = await runBoxAction(action, step.appName);
        emit({ stepId: action.id, timestamp: new Date().toISOString(), ...actionResult });
        if (actionResult.status === 'error') ok = false;
      }
      continue;
    }

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
    const groupId = 'groupId' in step ? step.groupId : undefined;
    if (result.meta?.target) {
      registry.track(profile.id, result.meta.target);
    }
    if (result.meta?.windowIdHint !== undefined && groupId) {
      windowIdByGroup.set(groupId, result.meta.windowIdHint);
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
