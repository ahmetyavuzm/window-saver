import { useState } from 'react';
import type { DesktopLayoutMode, DesktopMode, ThemeMode, UserSettings } from '../../../shared/types';

type SettingsTab = 'interface' | 'behavior';

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

const DESKTOP_LAYOUT_OPTIONS: { value: DesktopLayoutMode; label: string }[] = [
  { value: 'tabs', label: 'Tabs' },
  { value: 'grid', label: 'Side by side' },
];

const DESKTOP_MODE_OPTIONS: { value: DesktopMode; label: string; hint: string }[] = [
  { value: 'reuse', label: 'Reuse existing', hint: 'Mevcut masaüstündeki pencereleri kullan' },
  { value: 'createNew', label: 'Always new', hint: 'Her çalıştırmada yeni masaüstü oluştur' },
];

// A handful of tasteful presets; the color input covers everything else.
const ACCENT_PRESETS = ['#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff9f0a', '#30d158', '#64d2ff'];

export function SettingsPanel({ settings, onUpdate, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>('interface');

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
            <button
              className={`settings-nav-item${tab === 'interface' ? ' active' : ''}`}
              onClick={() => setTab('interface')}
            >
              Interface
            </button>
            <button
              className={`settings-nav-item${tab === 'behavior' ? ' active' : ''}`}
              onClick={() => setTab('behavior')}
            >
              Behavior
            </button>
          </nav>

          {tab === 'interface' && (
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
                <label>Desktop layout</label>
                <div className="segmented">
                  {DESKTOP_LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`segmented-option${settings.desktopLayout === opt.value ? ' active' : ''}`}
                      onClick={() => onUpdate({ desktopLayout: opt.value })}
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
          )}

          {tab === 'behavior' && (
            <section className="settings-section">
              <h3>Behavior</h3>

              <div className="settings-field">
                <label>Desktop mode</label>
                <div className="segmented">
                  {DESKTOP_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`segmented-option${settings.desktopMode === opt.value ? ' active' : ''}`}
                      onClick={() => onUpdate({ desktopMode: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="settings-hint">
                  {DESKTOP_MODE_OPTIONS.find((o) => o.value === settings.desktopMode)?.hint}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
