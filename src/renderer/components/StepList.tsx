import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Step } from '../../shared/types';

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}

interface Unit {
  id: string;
  groupId?: string;
  steps: Step[];
}

function getGroupId(step: Step): string | undefined {
  return 'groupId' in step ? step.groupId : undefined;
}

// Steps sharing a groupId (a canvas box's launch+wait+position steps, see App.tsx)
// are always created/persisted as a contiguous run, so a single left-to-right scan
// is enough to cluster them — no separate grouping index is needed.
function toUnits(steps: Step[]): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  while (i < steps.length) {
    const gid = getGroupId(steps[i]);
    if (gid) {
      const groupSteps = [steps[i]];
      let j = i + 1;
      while (j < steps.length && getGroupId(steps[j]) === gid) {
        groupSteps.push(steps[j]);
        j++;
      }
      units.push({ id: gid, groupId: gid, steps: groupSteps });
      i = j;
    } else {
      units.push({ id: steps[i].id, steps: [steps[i]] });
      i++;
    }
  }
  return units;
}

function fromUnits(units: Unit[]): Step[] {
  return units.flatMap((u) => u.steps);
}

function summarize(step: Step): string {
  switch (step.type) {
    case 'launchApp':
      return `Launch ${step.appName}`;
    case 'waitForWindow':
      return `Wait for ${step.appName} window`;
    case 'positionWindow': {
      const detail = [
        step.windowTitle ? `"${step.windowTitle}"` : null,
        step.spaceIndex !== undefined ? `space ${step.spaceIndex}` : null,
      ]
        .filter(Boolean)
        .join(', ');
      const target = step.placement ? 'custom placement' : step.rectangleAction ?? 'maximize';
      return `Position ${step.appName}${detail ? ` (${detail})` : ''} → ${target}`;
    }
    case 'openUrl':
      return `Open ${step.url} in ${step.browser}`;
    case 'openTerminal':
      return `Terminal @ ${step.cwd}${step.command ? ` → ${step.command}` : ''}`;
    case 'wait':
      return `Wait ${step.ms}ms`;
    case 'customAppleScript':
      return 'Custom AppleScript';
  }
}

function SortableUnitCard({ unit, onDelete }: { unit: Unit; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: unit.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (unit.steps.length === 1 && !unit.groupId) {
    const step = unit.steps[0];
    return (
      <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="step-card">
        <span className="step-type">{step.type}</span>
        <span className="step-summary">{summarize(step)}</span>
        <button
          className="delete-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      </li>
    );
  }

  // A grouped unit (a canvas box's steps) always moves/deletes as one block —
  // its internal step order can't be split apart via this list.
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="step-card step-group">
      <div className="step-group-body">
        <span className="step-type">group</span>
        <ul className="step-group-steps">
          {unit.steps.map((step) => (
            <li key={step.id}>
              <span className="step-type">{step.type}</span> {summarize(step)}
            </li>
          ))}
        </ul>
      </div>
      <button
        className="delete-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </li>
  );
}

export function StepList({ steps, onChange }: Props) {
  const units = toUnits(steps);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = units.findIndex((u) => u.id === active.id);
    const newIndex = units.findIndex((u) => u.id === over.id);
    onChange(fromUnits(arrayMove(units, oldIndex, newIndex)));
  }

  function handleDelete(unit: Unit) {
    const idsToRemove = new Set(unit.steps.map((s) => s.id));
    onChange(steps.filter((s) => !idsToRemove.has(s.id)));
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={units.map((u) => u.id)} strategy={verticalListSortingStrategy}>
        <ul className="step-list">
          {units.map((unit) => (
            <SortableUnitCard key={unit.id} unit={unit} onDelete={() => handleDelete(unit)} />
          ))}
          {units.length === 0 && <li className="empty">No steps yet — add one below.</li>}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
