import { screen, type Display } from 'electron';
import type { DisplayRef, NormalizedRect } from '../../shared/types.js';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayResolution {
  display: Display;
  usedFallback: boolean;
  fallbackReason?: string;
}

// Resolves a saved DisplayRef to a currently-connected Electron Display.
// Falls back defensively if the exact display is no longer present (monitor
// unplugged/replaced) instead of silently mis-placing the window — always
// reports which path was taken so callers can log it.
export function resolveDisplayForPlacement(ref: DisplayRef): DisplayResolution {
  const displays = screen.getAllDisplays();

  const exact = displays.find((d) => d.id === ref.displayId);
  if (exact) return { display: exact, usedFallback: false };

  let nearest = displays[0];
  let bestDiff = Infinity;
  for (const d of displays) {
    const diff = Math.abs(d.size.width - ref.widthPx) + Math.abs(d.size.height - ref.heightPx);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = d;
    }
  }
  if (nearest) {
    return {
      display: nearest,
      usedFallback: true,
      fallbackReason: `saved display not found, using nearest match by resolution (${nearest.size.width}x${nearest.size.height})`,
    };
  }

  const primary = screen.getPrimaryDisplay();
  return {
    display: primary,
    usedFallback: true,
    fallbackReason: `saved display not found and no displays enumerated, using primary display`,
  };
}

// Converts a 0..1 NormalizedRect (relative to a display's workArea) into
// absolute pixel Bounds in the same top-left-origin coordinate space used
// throughout this engine (Electron `screen` and System Events agree on this).
export function boundsFromNormalizedRect(rect: NormalizedRect, workArea: Bounds): Bounds {
  return {
    x: Math.round(workArea.x + rect.x * workArea.width),
    y: Math.round(workArea.y + rect.y * workArea.height),
    width: Math.round(rect.width * workArea.width),
    height: Math.round(rect.height * workArea.height),
  };
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
