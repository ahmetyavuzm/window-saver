import { useMemo } from 'react';
import type { DisplayInfo, NormalizedRect, Step } from '../../shared/types';

export interface LayoutBox {
  groupId: string;
  displayId: number;
  rect: NormalizedRect;
  label: string;
}

function labelFor(step: Step): string {
  switch (step.type) {
    case 'launchApp':
      return step.appName;
    case 'openUrl':
      return step.url;
    case 'openTerminal':
      return `Terminal: ${step.cwd}`;
    default:
      return step.type;
  }
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
    boxes.push({
      groupId,
      displayId: posStep.placement.display.displayId,
      rect: posStep.placement.rect,
      label: launchStep ? labelFor(launchStep) : posStep.appName,
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

export function addBoxSteps(steps: Step[], display: DisplayInfo, appName: string): Step[] {
  const groupId = newGroupId();
  const launchStep: Step = {
    type: 'launchApp',
    id: `${groupId}-launch`,
    appName,
    groupId,
  };
  const waitStep: Step = {
    type: 'waitForWindow',
    id: `${groupId}-wait`,
    appName,
    timeoutMs: 8000,
    groupId,
  };
  const positionStep: Step = {
    type: 'positionWindow',
    id: `${groupId}-position`,
    appName,
    placement: {
      display: { displayId: display.id, widthPx: display.bounds.width, heightPx: display.bounds.height },
      rect: DEFAULT_BOX_RECT,
    },
    groupId,
  };
  return [...steps, launchStep, waitStep, positionStep];
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
