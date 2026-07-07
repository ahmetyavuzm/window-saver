import type { ReactNode } from 'react';
import { DisplayFrame } from './DisplayFrame';
import type { DisplayInfo } from '../../../shared/types';

const CANVAS_MAX_WIDTH = 640;

interface LayoutCanvasProps {
  displays: DisplayInfo[];
  renderBoxes?: (display: DisplayInfo, scale: number) => ReactNode;
}

export function LayoutCanvas({ displays, renderBoxes }: LayoutCanvasProps) {
  if (displays.length === 0) {
    return <div className="layout-canvas empty-state">Detecting displays…</div>;
  }

  // Draw the canvas in workArea space (menu bar / dock excluded), not full
  // display bounds. A box's NormalizedRect is defined relative to workArea
  // and that's where the engine actually places the window, so the canvas
  // must use the same space or what you draw won't match where it lands.
  const minX = Math.min(...displays.map((d) => d.workArea.x));
  const minY = Math.min(...displays.map((d) => d.workArea.y));
  const maxX = Math.max(...displays.map((d) => d.workArea.x + d.workArea.width));
  const maxY = Math.max(...displays.map((d) => d.workArea.y + d.workArea.height));
  const unionWidth = maxX - minX;
  const unionHeight = maxY - minY;

  const scale = Math.min(CANVAS_MAX_WIDTH / unionWidth, 1);
  const canvasWidth = unionWidth * scale;
  const canvasHeight = unionHeight * scale;

  return (
    <div className="layout-canvas" style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
      {displays.map((display) => (
        <DisplayFrame
          key={display.id}
          display={display}
          left={(display.workArea.x - minX) * scale}
          top={(display.workArea.y - minY) * scale}
          width={display.workArea.width * scale}
          height={display.workArea.height * scale}
        >
          {renderBoxes?.(display, scale)}
        </DisplayFrame>
      ))}
    </div>
  );
}
