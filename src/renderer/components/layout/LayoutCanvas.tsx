import type { ReactNode } from 'react';
import { useDisplays } from '../../hooks/useDisplays';
import { DisplayFrame } from './DisplayFrame';
import type { DisplayInfo } from '../../../shared/types';

const CANVAS_MAX_WIDTH = 640;

interface LayoutCanvasProps {
  renderBoxes?: (display: DisplayInfo, scale: number) => ReactNode;
}

export function LayoutCanvas({ renderBoxes }: LayoutCanvasProps) {
  const displays = useDisplays();

  if (displays.length === 0) {
    return <div className="layout-canvas empty-state">Detecting displays…</div>;
  }

  const minX = Math.min(...displays.map((d) => d.bounds.x));
  const minY = Math.min(...displays.map((d) => d.bounds.y));
  const maxX = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
  const maxY = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
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
          left={(display.bounds.x - minX) * scale}
          top={(display.bounds.y - minY) * scale}
          width={display.bounds.width * scale}
          height={display.bounds.height * scale}
        >
          {renderBoxes?.(display, scale)}
        </DisplayFrame>
      ))}
    </div>
  );
}
