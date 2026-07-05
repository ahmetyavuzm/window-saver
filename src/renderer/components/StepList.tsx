import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Step } from '../../shared/types';

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
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

function SortableStepCard({ step, onDelete }: { step: Step; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

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

export function StepList({ steps, onChange }: Props) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    onChange(arrayMove(steps, oldIndex, newIndex));
  }

  function handleDelete(id: string) {
    onChange(steps.filter((s) => s.id !== id));
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="step-list">
          {steps.map((step) => (
            <SortableStepCard key={step.id} step={step} onDelete={() => handleDelete(step.id)} />
          ))}
          {steps.length === 0 && <li className="empty">No steps yet — add one below.</li>}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
