import { useMemo } from 'react';
import type { DisplayInfo, NormalizedRect, Step } from '../../shared/types';
import type { Browser } from '../components/fields/OpenUrlFields';

export type BoxKind = 'launchApp' | 'openUrl' | 'openTerminal';

export interface BoxConfig {
  kind: BoxKind;
  appName?: string;
  autoInsertWait?: boolean;
  url?: string;
  browser?: Browser;
  cwd?: string;
  command?: string;
}

export interface LayoutBox {
  groupId: string;
  displayId: number;
  rect: NormalizedRect;
  label: string;
  config: BoxConfig;
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
    return { kind: 'launchApp', appName: step.appName, autoInsertWait: true };
  }
  if (step.type === 'openUrl') {
    return { kind: 'openUrl', url: step.url, browser: step.browser };
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
    const steps: Step[] = [{ type: 'launchApp', id: `${groupId}-launch`, appName, groupId }];
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
    boxes.push({
      groupId,
      displayId: posStep.placement.display.displayId,
      rect: posStep.placement.rect,
      label: labelFor(finalConfig),
      config: finalConfig,
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

export function createBoxSteps(steps: Step[], display: DisplayInfo, config: BoxConfig): Step[] {
  const groupId = newGroupId();
  const built = buildKindSteps(groupId, config);
  const positionStep: Step = {
    type: 'positionWindow',
    id: `${groupId}-position`,
    appName: appNameForConfig(config),
    placement: {
      display: { displayId: display.id, widthPx: display.bounds.width, heightPx: display.bounds.height },
      rect: DEFAULT_BOX_RECT,
    },
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

  return [...before, ...built, updatedPosition, ...after];
}

export function updateBoxRect(steps: Step[], groupId: string, rect: NormalizedRect): Step[] {
  return steps.map((step) => {
    if (step.type !== 'positionWindow' || step.groupId !== groupId || !step.placement) return step;
    return { ...step, placement: { ...step.placement, rect } };
  });
}

export function deleteBox(steps: Step[], groupId: string): Step[] {
  return steps.filter((step) => getGroupId(step) !== groupId);
}
