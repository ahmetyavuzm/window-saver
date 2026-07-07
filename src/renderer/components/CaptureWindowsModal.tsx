import { useEffect, useState } from 'react';
import type { CapturedWindow, DisplayInfo } from '../../shared/types';

interface Props {
  displays: DisplayInfo[];
  onCreate: (name: string, windows: CapturedWindow[]) => Promise<void>;
  onClose: () => void;
}

function displayLabel(displays: DisplayInfo[], id: number): string {
  const d = displays.find((x) => x.id === id);
  if (!d) return `Display ${id}`;
  return d.isPrimary ? 'Primary' : `Display ${id}`;
}

// Lists the live windows captured from the screen and lets the user pick which
// ones to save into a new profile.
export function CaptureWindowsModal({ displays, onCreate, onClose }: Props) {
  const [windows, setWindows] = useState<CapturedWindow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState('Captured layout');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await window.windowSaver.captureWindows();
        if (cancelled) return;
        setWindows(found);
        setSelected(new Set(found.map((_, i) => i))); // default: all selected
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function submit() {
    if (!windows) return;
    const chosen = windows.filter((_, i) => selected.has(i));
    if (chosen.length === 0 || !name.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), chosen);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="capture-modal" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Save Windows</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="capture-body">
          {error && <p className="capture-error">{error}</p>}
          {!windows && !error && <p className="capture-empty">Scanning open windows…</p>}
          {windows && windows.length === 0 && (
            <p className="capture-empty">
              No standard windows found. (Save Windows needs yabai to read window positions.)
            </p>
          )}
          {windows && windows.length > 0 && (
            <ul className="capture-list">
              {windows.map((w, i) => (
                <li key={i} className="capture-item">
                  <label>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                    <span className="capture-app">{w.appName}</span>
                    <span className="capture-meta">
                      {displayLabel(displays, w.displayId)} · Desktop {w.desktopIndex ?? 1}
                      {w.fullscreen && <span className="capture-fs"> ⛶ Fullscreen</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="capture-footer">
          <input
            className="new-profile-input"
            placeholder="Profile name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="capture-actions">
            <button className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={busy || !windows || selected.size === 0 || !name.trim()}
            >
              {busy ? 'Creating…' : `Create profile (${selected.size})`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
