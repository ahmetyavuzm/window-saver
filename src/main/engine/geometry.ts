export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Computes the target window bounds for a Rectangle-style action name within
// a given display's work area. Coordinates are top-left-origin, matching both
// Electron's `screen` module and System Events' window `position`/`size`.
export function computeTargetBounds(action: string, area: Bounds): Bounds {
  const { x, y, width, height } = area;
  const halfW = Math.round(width / 2);
  const halfH = Math.round(height / 2);
  const rightX = x + width - halfW;
  const bottomY = y + height - halfH;

  switch (action) {
    case 'left-half':
      return { x, y, width: halfW, height };
    case 'right-half':
      return { x: rightX, y, width: halfW, height };
    case 'top-half':
      return { x, y, width, height: halfH };
    case 'bottom-half':
      return { x, y: bottomY, width, height: halfH };
    case 'top-left':
      return { x, y, width: halfW, height: halfH };
    case 'top-right':
      return { x: rightX, y, width: halfW, height: halfH };
    case 'bottom-left':
      return { x, y: bottomY, width: halfW, height: halfH };
    case 'bottom-right':
      return { x: rightX, y: bottomY, width: halfW, height: halfH };
    case 'center': {
      const w = Math.round(width * 0.6);
      const h = Math.round(height * 0.6);
      return { x: x + Math.round((width - w) / 2), y: y + Math.round((height - h) / 2), width: w, height: h };
    }
    case 'maximize':
    default:
      return { x, y, width, height };
  }
}
