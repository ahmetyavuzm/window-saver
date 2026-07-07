import { useCallback, useEffect, useState } from 'react';
import type { Settings, ThemeMode, UserSettings } from '../../shared/types';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  }
  return mode;
}

// Perceived luminance (sRGB) -> pick readable text color on top of the accent.
function readableOn(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1d1d1f' : '#ffffff';
}

// Applies theme + accent to the document root as attribute/CSS variables.
// styles.css derives everything else (hover shades, soft fills) from these
// via color-mix, so JS only needs to set the two source-of-truth values.
function applySettings(settings: Pick<Settings, 'theme' | 'accentColor'>): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme);
  root.style.setProperty('--accent', settings.accentColor);
  root.style.setProperty('--accent-fg', readableOn(settings.accentColor));
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void window.windowSaver.getSettings().then((s) => {
      setSettings(s);
      applySettings(s);
    });
  }, []);

  // Re-resolve when the OS appearance flips, but only while in system mode.
  useEffect(() => {
    if (!settings || settings.theme !== 'system') return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => applySettings(settings);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings]);

  const updateSettings = useCallback(async (partial: Partial<UserSettings>) => {
    const next = await window.windowSaver.updateSettings(partial);
    setSettings(next);
    applySettings(next);
  }, []);

  return { settings, updateSettings };
}
