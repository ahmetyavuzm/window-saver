export type DesktopSelection = number | 'all';

interface Props {
  desktops: number[]; // e.g. [1, 2, 3]
  active: DesktopSelection;
  deletableDesktop?: number; // the top desktop when it is empty and removable
  onSelect: (d: DesktopSelection) => void;
  onAdd: () => void;
  onDelete?: (d: number) => void;
}

// Per-display tab bar. Desktop 1 is the display's default (no yabai Space move);
// Desktop N>1 maps to that display's Nth Space, resolved at run time. "All"
// shows every box on the display at once. Only the top-most empty desktop can be
// deleted (shown with an ×) so desktop numbers stay contiguous.
export function DesktopTabs({ desktops, active, deletableDesktop, onSelect, onAdd, onDelete }: Props) {
  return (
    <div className="desktop-tabs" role="tablist">
      {desktops.map((d) => (
        <span key={d} className={`desktop-tab-wrap${active === d ? ' active' : ''}`}>
          <button
            role="tab"
            aria-selected={active === d}
            className={`desktop-tab${active === d ? ' active' : ''}`}
            onClick={() => onSelect(d)}
          >
            Desktop {d}
          </button>
          {onDelete && deletableDesktop === d && (
            <button
              className="desktop-tab-delete"
              aria-label={`Delete desktop ${d}`}
              title={`Delete desktop ${d}`}
              onClick={() => onDelete(d)}
            >
              ×
            </button>
          )}
        </span>
      ))}
      <button
        role="tab"
        aria-selected={active === 'all'}
        className={`desktop-tab${active === 'all' ? ' active' : ''}`}
        onClick={() => onSelect('all')}
      >
        All
      </button>
      <button className="desktop-tab desktop-tab-add" onClick={onAdd} aria-label="Add desktop" title="Add desktop">
        +
      </button>
    </div>
  );
}
