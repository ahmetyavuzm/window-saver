import type { ReactNode } from 'react';
import type { DisplayInfo } from '../../../shared/types';
import type { LayoutBox } from '../../hooks/useLayoutBoxes';

// Widest a single desktop frame may draw; workArea is scaled down to fit so
// several desktops sit side by side. Small screens (scale would exceed 1) are
// never scaled up.
const FRAME_MAX_WIDTH = 260;

interface Props {
  displays: DisplayInfo[];
  desktopsFor: (displayId: number) => number[];
  boxesFor: (displayId: number, desktop: number) => LayoutBox[];
  renderBox: (box: LayoutBox, display: DisplayInfo, scale: number) => ReactNode;
  deletableDesktopFor: (displayId: number) => number | undefined;
  onAddDesktop: (displayId: number) => void;
  onDeleteDesktop: (displayId: number, desktop: number) => void;
  onAddWindow: (display: DisplayInfo, desktop: number) => void;
}

// "Grid" layout: one row per physical display, its Desktop 1,2,3… drawn as
// separate side-by-side frames so every desktop is editable at once (the
// alternative to the tab strip). Each frame is a single display's workArea to
// scale, holding only the boxes assigned to that display + desktop.
export function DesktopGrid({
  displays,
  desktopsFor,
  boxesFor,
  renderBox,
  deletableDesktopFor,
  onAddDesktop,
  onDeleteDesktop,
  onAddWindow,
}: Props) {
  if (displays.length === 0) {
    return <div className="layout-canvas empty-state">Detecting displays…</div>;
  }

  return (
    <div className="desktop-grid">
      {displays.map((display) => {
        const scale = Math.min(FRAME_MAX_WIDTH / display.workArea.width, 1);
        const frameW = display.workArea.width * scale;
        const frameH = display.workArea.height * scale;
        const deletable = deletableDesktopFor(display.id);
        return (
          <div className="desktop-grid-row" key={display.id}>
            <span className="desktop-grid-screen">
              {display.isPrimary ? 'Primary' : `Display ${display.id}`}
            </span>
            <div className="desktop-grid-frames">
              {desktopsFor(display.id).map((desktop) => (
                <div className="desktop-grid-frame" key={desktop}>
                  <div className="desktop-grid-frame-header">
                    <span className="desktop-grid-frame-title">Desktop {desktop}</span>
                    <span className="desktop-grid-frame-actions">
                      <button
                        className="desktop-grid-add-window"
                        title="Add window to this desktop"
                        aria-label={`Add window to desktop ${desktop}`}
                        onClick={() => onAddWindow(display, desktop)}
                      >
                        +
                      </button>
                      {deletable === desktop && (
                        <button
                          className="desktop-tab-delete"
                          title={`Delete desktop ${desktop}`}
                          aria-label={`Delete desktop ${desktop}`}
                          onClick={() => onDeleteDesktop(display.id, desktop)}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  </div>
                  <div
                    className="display-frame desktop-grid-canvas"
                    style={{ position: 'relative', width: frameW, height: frameH }}
                    data-display-id={display.id}
                  >
                    {boxesFor(display.id, desktop).map((box) => renderBox(box, display, scale))}
                  </div>
                </div>
              ))}
              <button
                className="desktop-grid-add-desktop"
                title="Add desktop"
                aria-label={`Add desktop to ${display.isPrimary ? 'primary' : `display ${display.id}`}`}
                onClick={() => onAddDesktop(display.id)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
