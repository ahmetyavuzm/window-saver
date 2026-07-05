import type { ReactNode } from 'react';
import type { DisplayInfo } from '../../../shared/types';

interface DisplayFrameProps {
  display: DisplayInfo;
  left: number;
  top: number;
  width: number;
  height: number;
  children?: ReactNode;
}

export function DisplayFrame({ display, left, top, width, height, children }: DisplayFrameProps) {
  return (
    <div
      className="display-frame"
      style={{ position: 'absolute', left, top, width, height }}
      data-display-id={display.id}
    >
      <div className="display-frame-label">
        {display.bounds.width}×{display.bounds.height}
        {display.isPrimary ? ' (primary)' : ''}
      </div>
      {children}
    </div>
  );
}
