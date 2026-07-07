import { useMemo } from 'react';
import type { DisplayInfo, NormalizedRect, Step } from '../../shared/types';
import type { Browser } from '../components/fields/OpenUrlFields';

export type BoxKind = 'launchApp' | 'openUrl' | 'openTerminal';

export interface BoxConfig {
  kind: BoxKind;
  appName?: string;
  autoInsertWait?: boolean;
  openNewWindow?: boolean; // launchApp: force a new instance/window (open -n)
  url?: string;
  browser?: Browser;
  newWindow?: boolean; // openUrl: open a dedicated window instead of a tab
  cwd?: string;
  command?: string;
  fullscreen?: boolean; // open the window filling the display (ignores rect)
  // How a fullscreen box fills the display: native (own Space, not draggable)
  // or maximize (fills workArea, keeps title bar, draggable). Default 'native'.
  fullscreenMode?: 'native' | 'maximize';
}

export interface LayoutBox {
  groupId: string;
  displayId: number;
  rect: NormalizedRect;
  label: string;
  config: BoxConfig;
  desktopIndex?: number; // desktop within this box's display; undefined/1 = current desktop
  fullscreen?: boolean;
  fullscreenMode?: 'native' | 'maximize';
}

// A box is "fullscreen" when its rect fills the whole display workArea. Used
// both to drive the canvas badge and to auto-mark a box fullscreen when the
// user drags/resizes it to cover the entire frame.
const FULLSCREEN_RECT: NormalizedRect = { x: 0, y: 0, width: 1, height: 1 };
export function isFullscreenRect(rect: NormalizedRect): boolean {
  const eps = 0.02;
  return (
    Math.abs(rect.x) < eps &&
    Math.abs(rect.y) < eps &&
    Math.abs(rect.width - 1) < eps &&
    Math.abs(rect.height - 1) < eps
  );
}

function labelFor(config: BoxConfig): string {
  switch (config.kind) {
    case 'launchApp':
      return config.appName ?? '';
    case 'openUrl':
      return config.url ?? '';
    case 'openTerminal':
      return `Terminal: ${config.cwd ?? ''}`;
    default:
      return '';
  }
}

function configFromStep(step: Step): BoxConfig | undefined {
  if (step.type === 'launchApp') {
    return { kind: 'launchApp', appName: step.appName, autoInsertWait: true, openNewWindow: step.openNewWindow ?? false };
  }
  if (step.type === 'openUrl') {
    return { kind: 'openUrl', url: step.url, browser: step.browser, newWindow: step.newWindow ?? false };
  }
  if (step.type === 'openTerminal') {
    return { kind: 'openTerminal', cwd: step.cwd, command: step.command };
  }
  return undefined;
}

// appName for positionWindow targeting: openUrl needs a concrete browser
// (AppleScript can't target "the default browser" generically), openTerminal
// is always the Terminal app.
export function appNameForConfig(config: BoxConfig): string {
  if (config.kind === 'launchApp') return config.appName ?? '';
  if (config.kind === 'openUrl') return config.browser && config.browser !== 'default' ? config.browser : 'Safari';
  return 'Terminal';
}

function buildKindSteps(groupId: string, config: BoxConfig): Step[] {
  if (config.kind === 'launchApp') {
    const appName = config.appName ?? '';
    const steps: Step[] = [
      {
        type: 'launchApp',
        id: `${groupId}-launch`,
        appName,
        ...(config.openNewWindow ? { openNewWindow: true } : {}),
        groupId,
      },
    ];
    if (config.autoInsertWait ?? true) {
      steps.push({ type: 'waitForWindow', id: `${groupId}-wait`, appName, timeoutMs: 8000, groupId });
    }
    return steps;
  }
  if (config.kind === 'openUrl') {
    return [
      {
        type: 'openUrl',
        id: `${groupId}-launch`,
        url: config.url ?? '',
        browser: config.browser ?? 'default',
        ...(config.newWindow ? { newWindow: true } : {}),
        groupId,
      },
    ];
  }
  return [
    {
      type: 'openTerminal',
      id: `${groupId}-launch`,
      app: 'Terminal',
      cwd: config.cwd ?? '',
      command: config.command || undefined,
      groupId,
    },
  ];
}

function getGroupId(step: Step): string | undefined {
  return 'groupId' in step ? step.groupId : undefined;
}

export function deriveBoxes(steps: Step[]): LayoutBox[] {
  const groups = new Map<string, Step[]>();
  for (const step of steps) {
    const gid = getGroupId(step);
    if (!gid) continue;
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid)!.push(step);
  }

  const boxes: LayoutBox[] = [];
  for (const [groupId, groupSteps] of groups) {
    const posStep = groupSteps.find((s) => s.type === 'positionWindow' && s.placement);
    if (!posStep || posStep.type !== 'positionWindow' || !posStep.placement) continue;
    const launchStep = groupSteps.find((s) => s.type === 'launchApp' || s.type === 'openUrl' || s.type === 'openTerminal');
    const config = launchStep ? configFromStep(launchStep) : undefined;
    const finalConfig: BoxConfig = config ?? { kind: 'launchApp', appName: posStep.appName, autoInsertWait: true };
    finalConfig.fullscreen = posStep.fullscreen ?? false;
    finalConfig.fullscreenMode = posStep.fullscreenMode ?? 'native';
    boxes.push({
      groupId,
      displayId: posStep.placement.display.displayId,
      rect: posStep.placement.rect,
      label: labelFor(finalConfig),
      config: finalConfig,
      desktopIndex: posStep.desktopIndex,
      fullscreen: posStep.fullscreen ?? false,
      fullscreenMode: posStep.fullscreenMode ?? 'native',
    });
  }
  return boxes;
}

export function useLayoutBoxes(steps: Step[]): LayoutBox[] {
  return useMemo(() => deriveBoxes(steps), [steps]);
}

let boxCounter = 0;
function newGroupId(): string {
  boxCounter += 1;
  return `box-${Date.now()}-${boxCounter}`;
}

const DEFAULT_BOX_RECT: NormalizedRect = { x: 0.2, y: 0.2, width: 0.3, height: 0.3 };

export function createBoxSteps(
  steps: Step[],
  display: DisplayInfo,
  config: BoxConfig,
  desktopIndex?: number,
): Step[] {
  const groupId = newGroupId();
  const built = buildKindSteps(groupId, config);
  const positionStep: Step = {
    type: 'positionWindow',
    id: `${groupId}-position`,
    appName: appNameForConfig(config),
    placement: {
      display: { displayId: display.id, widthPx: display.bounds.width, heightPx: display.bounds.height },
      rect: config.fullscreen ? FULLSCREEN_RECT : DEFAULT_BOX_RECT,
    },
    ...(desktopIndex !== undefined ? { desktopIndex } : {}),
    ...(config.fullscreen ? { fullscreen: true } : {}),
    ...(config.fullscreen && config.fullscreenMode === 'maximize' ? { fullscreenMode: 'maximize' as const } : {}),
    groupId,
  };
  return [...steps, ...built, positionStep];
}

export function updateBoxConfig(steps: Step[], groupId: string, config: BoxConfig): Step[] {
  const positionStep = steps.find((s) => s.type === 'positionWindow' && getGroupId(s) === groupId);
  if (!positionStep || positionStep.type !== 'positionWindow' || !positionStep.placement) return steps;

  const originalIndex = steps.findIndex((s) => getGroupId(s) === groupId);
  const nonGroupBeforeCount = steps.slice(0, originalIndex).filter((s) => getGroupId(s) !== groupId).length;

  const others = steps.filter((s) => getGroupId(s) !== groupId);
  const before = others.slice(0, nonGroupBeforeCount);
  const after = others.slice(nonGroupBeforeCount);

  const built = buildKindSteps(groupId, config);
  const updatedPosition: Step = { ...positionStep, appName: appNameForConfig(config) };
  // Fullscreen is stored on the position step and forces a full-display rect.
  // Turning it off restores an editable rect if the box was still full-screen.
  if (config.fullscreen) {
    updatedPosition.fullscreen = true;
    if (config.fullscreenMode === 'maximize') updatedPosition.fullscreenMode = 'maximize';
    else delete updatedPosition.fullscreenMode;
    updatedPosition.placement = { ...positionStep.placement, rect: FULLSCREEN_RECT };
  } else {
    delete updatedPosition.fullscreen;
    delete updatedPosition.fullscreenMode;
    if (isFullscreenRect(positionStep.placement.rect)) {
      updatedPosition.placement = { ...positionStep.placement, rect: DEFAULT_BOX_RECT };
    }
  }

  return [...before, ...built, updatedPosition, ...after];
}

// Re-target the box's window to a different display. The rect is a workArea-
// relative NormalizedRect (display-independent), so only placement.display
// changes — same shape createBoxSteps builds. Desktops are per-display, so
// callers typically clear/reset desktopIndex separately (see App.onDisplayChange).
export function updateBoxDisplay(steps: Step[], groupId: string, display: DisplayInfo): Step[] {
  return steps.map((step) => {
    if (step.type !== 'positionWindow' || step.groupId !== groupId || !step.placement) return step;
    return {
      ...step,
      placement: {
        ...step.placement,
        display: { displayId: display.id, widthPx: display.bounds.width, heightPx: display.bounds.height },
      },
    };
  });
}

// Update the box's placement rect (canvas drag/resize). Dragging a box to cover
// the whole frame auto-marks it fullscreen; shrinking it back clears the flag.
export function updateBoxRect(steps: Step[], groupId: string, rect: NormalizedRect): Step[] {
  return steps.map((step) => {
    if (step.type !== 'positionWindow' || step.groupId !== groupId || !step.placement) return step;
    const next: Step = { ...step, placement: { ...step.placement, rect } };
    // Cover-the-frame auto-marks fullscreen but keeps the existing mode (native
    // vs maximize); shrinking back clears both.
    if (isFullscreenRect(rect)) next.fullscreen = true;
    else {
      delete next.fullscreen;
      delete next.fullscreenMode;
    }
    return next;
  });
}

// Assign the box's window to a desktop within its own display. Passing undefined
// clears the assignment (window stays on whatever desktop is current at run).
export function updateBoxDesktop(steps: Step[], groupId: string, desktopIndex: number | undefined): Step[] {
  return steps.map((step) => {
    if (step.type !== 'positionWindow' || step.groupId !== groupId) return step;
    const next = { ...step };
    if (desktopIndex === undefined) delete next.desktopIndex;
    else next.desktopIndex = desktopIndex;
    return next;
  });
}

export function deleteBox(steps: Step[], groupId: string): Step[] {
  return steps.filter((step) => getGroupId(step) !== groupId);
}
