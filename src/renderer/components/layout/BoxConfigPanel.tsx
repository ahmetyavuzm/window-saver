import { useState } from 'react';
import { LaunchAppFields, type LaunchAppValue } from '../fields/LaunchAppFields';
import { OpenUrlFields, type OpenUrlValue } from '../fields/OpenUrlFields';
import { OpenTerminalFields, type OpenTerminalValue } from '../fields/OpenTerminalFields';
import type { BoxConfig, BoxKind } from '../../hooks/useLayoutBoxes';
import type { BoxAction, DisplayInfo } from '../../../shared/types';
import { GENERIC_ACTIONS, catalogActionsFor } from '../../actionCatalog';

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

  const [actions, setActions] = useState<BoxAction[]>(initial.actions ?? []);
  const currentAppName =
    kind === 'launchApp' ? launchApp.appName : kind === 'openUrl' ? (openUrl.browser !== 'default' ? openUrl.browser : 'Safari') : 'Terminal';
  const templates = [...catalogActionsFor(currentAppName), ...GENERIC_ACTIONS];
  const [templateLabel, setTemplateLabel] = useState<string>(templates[0]?.label ?? '');
  const selectedTemplate = templates.find((t) => t.label === templateLabel);
  const [pendingValue, setPendingValue] = useState('');
  const [pendingMs, setPendingMs] = useState(1000);

  function addAction() {
    const t = selectedTemplate;
    if (!t) return;
    let action: BoxAction;
    if (t.kind === 'openTarget') {
      if (!pendingValue.trim()) return;
      action = { id: crypto.randomUUID(), kind: 'openTarget', label: t.label, value: pendingValue.trim() };
    } else if (t.kind === 'appleScript') {
      const script = t.script || pendingValue;
      if (!script.trim()) return;
      action = { id: crypto.randomUUID(), kind: 'appleScript', label: t.label, script };
    } else {
      action = { id: crypto.randomUUID(), kind: 'wait', label: t.label, ms: pendingMs };
    }
    setActions([...actions, action]);
    setPendingValue('');
  }

  function removeAction(id: string) {
    setActions(actions.filter((a) => a.id !== id));
  }

  function moveAction(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    setActions(next);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fs = { fullscreen, ...(fullscreen ? { fullscreenMode } : {}), ...(actions.length ? { actions } : {}) };
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
        <div className="box-actions-section">
          <label className="box-actions-title">Actions after launch</label>
          {actions.length > 0 && (
            <ul className="box-actions-list">
              {actions.map((a, i) => (
                <li key={a.id}>
                  <span>{a.label}</span>
                  <span className="box-actions-controls">
                    <button type="button" disabled={i === 0} onClick={() => moveAction(i, -1)}>
                      ↑
                    </button>
                    <button type="button" disabled={i === actions.length - 1} onClick={() => moveAction(i, 1)}>
                      ↓
                    </button>
                    <button type="button" onClick={() => removeAction(a.id)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="box-actions-add">
            <select
              value={templateLabel}
              onChange={(e) => {
                setTemplateLabel(e.target.value);
                setPendingValue('');
              }}
            >
              {templates.map((t) => (
                <option key={t.label} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
            {selectedTemplate?.kind === 'openTarget' && (
              <input
                placeholder={selectedTemplate.placeholder}
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
              />
            )}
            {selectedTemplate?.kind === 'appleScript' && !selectedTemplate.script && (
              <textarea
                placeholder="AppleScript…"
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
              />
            )}
            {selectedTemplate?.kind === 'wait' && (
              <input type="number" min={0} value={pendingMs} onChange={(e) => setPendingMs(Number(e.target.value))} />
            )}
            <button type="button" onClick={addAction}>
              Add
            </button>
          </div>
        </div>
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
