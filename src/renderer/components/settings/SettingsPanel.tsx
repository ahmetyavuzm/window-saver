import type { ThemeMode, UserSettings } from '../../../shared/types';

interface Props {
  settings: UserSettings;
  onUpdate: (partial: Partial<UserSettings>) => void;
  onClose: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

// A handful of tasteful presets; the color input covers everything else.
const ACCENT_PRESETS = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff'];

export function SettingsPanel({ settings, onUpdate, onClose }: Props) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </header>

        <div className="settings-body">
          <nav className="settings-nav">
            <button className="settings-nav-item active">Interface</button>
          </nav>

          <section className="settings-section">
            <h3>Interface</h3>

            <div className="settings-field">
              <label>Appearance</label>
              <div className="segmented">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`segmented-option${settings.theme === opt.value ? ' active' : ''}`}
                    onClick={() => onUpdate({ theme: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-field">
              <label>Accent color</label>
              <div className="accent-row">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    className={`accent-swatch${settings.accentColor.toLowerCase() === color ? ' active' : ''}`}
                    style={{ background: color }}
                    onClick={() => onUpdate({ accentColor: color })}
                    aria-label={`Accent ${color}`}
                  />
                ))}
                <label className="accent-custom" aria-label="Custom accent color">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => onUpdate({ accentColor: e.target.value })}
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
