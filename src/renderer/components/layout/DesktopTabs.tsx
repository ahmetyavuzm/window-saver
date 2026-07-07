export type DesktopSelection = number | 'all';

interface Props {
  desktops: number[]; // e.g. [1, 2, 3]
  active: DesktopSelection;
  onSelect: (d: DesktopSelection) => void;
  onAdd: () => void;
}

// Tab bar over the layout canvas. Desktop 1 is the default (no yabai Space
// move); Desktop N>1 maps to yabai Space N. "All" shows every box at once.
export function DesktopTabs({ desktops, active, onSelect, onAdd }: Props) {
  return (
    <div className="desktop-tabs" role="tablist">
      {desktops.map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={active === d}
          className={`desktop-tab${active === d ? ' active' : ''}`}
          onClick={() => onSelect(d)}
        >
          Desktop {d}
        </button>
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
