import { Rnd } from 'react-rnd';
import type { NormalizedRect } from '../../../shared/types';

interface WindowBoxProps {
  rect: NormalizedRect;
  parentWidth: number;
  parentHeight: number;
  label: string;
  fullscreen?: boolean;
  onChange: (rect: NormalizedRect) => void;
  onClick?: () => void;
  onDelete?: () => void;
}

const MIN_SIZE_PX = 40;

export function WindowBox({ rect, parentWidth, parentHeight, label, fullscreen, onChange, onClick, onDelete }: WindowBoxProps) {
  return (
    <Rnd
      className={fullscreen ? 'window-box window-box-fullscreen' : 'window-box'}
      bounds="parent"
      size={{ width: rect.width * parentWidth, height: rect.height * parentHeight }}
      position={{ x: rect.x * parentWidth, y: rect.y * parentHeight }}
      minWidth={MIN_SIZE_PX}
      minHeight={MIN_SIZE_PX}
      onDragStop={(_e, d) => {
        onChange({
          x: d.x / parentWidth,
          y: d.y / parentHeight,
          width: rect.width,
          height: rect.height,
        });
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        onChange({
          x: pos.x / parentWidth,
          y: pos.y / parentHeight,
          width: ref.offsetWidth / parentWidth,
          height: ref.offsetHeight / parentHeight,
        });
      }}
      onClick={onClick}
    >
      <div className="window-box-label">
        {fullscreen && <span className="window-box-fs-badge" title="Fullscreen">⛶</span>}
        {label}
      </div>
      {onDelete && (
        <button
          className="window-box-delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      )}
    </Rnd>
  );
}
