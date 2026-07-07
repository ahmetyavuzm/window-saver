import { useState } from 'react';
import { LaunchAppFields, type LaunchAppValue } from '../fields/LaunchAppFields';
import { OpenUrlFields, type OpenUrlValue } from '../fields/OpenUrlFields';
import { OpenTerminalFields, type OpenTerminalValue } from '../fields/OpenTerminalFields';
import type { BoxConfig, BoxKind } from '../../hooks/useLayoutBoxes';
import type { DisplayInfo } from '../../../shared/types';

interface Props {
  initial: BoxConfig;
  onSave: (config: BoxConfig) => void;
  onCancel: () => void;
  onDelete?: () => void;
  // Installed app names for the Launch App picker (native datalist autocomplete).
  installedApps?: string[];
  // Screen (display) assignment — only supplied when editing an existing box.
  displays?: DisplayInfo[];
  displayId?: number;
  onDisplayChange?: (displayId: number) => void;
  // Desktop (yabai Space) assignment — only supplied when editing an existing box.
  desktops?: number[];
  desktop?: number;
  onDesktopChange?: (desktop: number) => void;
}

export function BoxConfigPanel({
  initial,
  onSave,
  onCancel,
  onDelete,
  installedApps,
  displays,
  displayId,
  onDisplayChange,
  desktops,
  desktop,
  onDesktopChange,
}: Props) {
  const [kind, setKind] = useState<BoxKind>(initial.kind);
  const [launchApp, setLaunchApp] = useState<LaunchAppValue>({
    appName: initial.appName ?? '',
    autoInsertWait: initial.autoInsertWait ?? true,
    openNewWindow: initial.openNewWindow ?? false,
  });
  const [openUrl, setOpenUrl] = useState<OpenUrlValue>({
    url: initial.url ?? '',
    browser: initial.browser && initial.browser !== 'default' ? initial.browser : 'Google Chrome',
    newWindow: initial.newWindow ?? false,
  });
  const [openTerminal, setOpenTerminal] = useState<OpenTerminalValue>({
    cwd: initial.cwd ?? '',
    command: initial.command ?? '',
  });
  const [fullscreen, setFullscreen] = useState<boolean>(initial.fullscreen ?? false);
  const [fullscreenMode, setFullscreenMode] = useState<'native' | 'maximize'>(
    initial.fullscreenMode ?? 'native',
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fs = { fullscreen, ...(fullscreen ? { fullscreenMode } : {}) };
    if (kind === 'launchApp') {
      onSave({
        kind,
        appName: launchApp.appName,
        autoInsertWait: launchApp.autoInsertWait,
        openNewWindow: launchApp.openNewWindow,
        ...fs,
      });
    } else if (kind === 'openUrl') {
      onSave({ kind, url: openUrl.url, browser: openUrl.browser, newWindow: openUrl.newWindow, ...fs });
    } else {
      onSave({ kind, cwd: openTerminal.cwd, command: openTerminal.command || undefined, ...fs });
    }
  }

  return (
    <div className="box-config-overlay" onClick={onCancel}>
      <form className="box-config-panel" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <h3>Configure window</h3>
        <select value={kind} onChange={(e) => setKind(e.target.value as BoxKind)}>
          <option value="launchApp">Launch App</option>
          <option value="openUrl">Open URL</option>
          <option value="openTerminal">Open Terminal</option>
        </select>
        {kind === 'launchApp' && (
          <LaunchAppFields value={launchApp} onChange={setLaunchApp} installedApps={installedApps} />
        )}
        {kind === 'openUrl' && <OpenUrlFields value={openUrl} onChange={setOpenUrl} allowDefaultBrowser={false} />}
        {kind === 'openTerminal' && <OpenTerminalFields value={openTerminal} onChange={setOpenTerminal} />}
        {displays && displayId !== undefined && onDisplayChange && (
          <label className="box-config-desktop">
            Screen
            <select value={displayId} onChange={(e) => onDisplayChange(Number(e.target.value))}>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.isPrimary ? 'Primary' : `Display ${d.id}`} ({d.bounds.width}×{d.bounds.height})
                </option>
              ))}
            </select>
          </label>
        )}
        {desktops && desktop !== undefined && onDesktopChange && (
          <label className="box-config-desktop">
            Desktop
            <select value={desktop} onChange={(e) => onDesktopChange(Number(e.target.value))}>
              {desktops.map((d) => (
                <option key={d} value={d}>
                  Desktop {d}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="box-config-fullscreen">
          <input type="checkbox" checked={fullscreen} onChange={(e) => setFullscreen(e.target.checked)} />
          Fullscreen (fill the display)
        </label>
        {fullscreen && (
          <div className="box-config-fs-mode">
            <label>
              <input
                type="radio"
                name="fullscreenMode"
                checked={fullscreenMode === 'native'}
                onChange={() => setFullscreenMode('native')}
              />
              Native fullscreen <span className="box-config-fs-hint">— own Space, not draggable</span>
            </label>
            <label>
              <input
                type="radio"
                name="fullscreenMode"
                checked={fullscreenMode === 'maximize'}
                onChange={() => setFullscreenMode('maximize')}
              />
              Maximize <span className="box-config-fs-hint">— fills screen, keeps title bar, draggable</span>
            </label>
          </div>
        )}
        <div className="box-config-actions">
          {onDelete && (
            <button type="button" className="box-config-delete" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}
