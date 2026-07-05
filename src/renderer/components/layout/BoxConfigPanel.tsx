import { useState } from 'react';
import { LaunchAppFields, type LaunchAppValue } from '../fields/LaunchAppFields';
import { OpenUrlFields, type OpenUrlValue } from '../fields/OpenUrlFields';
import { OpenTerminalFields, type OpenTerminalValue } from '../fields/OpenTerminalFields';
import type { BoxConfig, BoxKind } from '../../hooks/useLayoutBoxes';

interface Props {
  initial: BoxConfig;
  onSave: (config: BoxConfig) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function BoxConfigPanel({ initial, onSave, onCancel, onDelete }: Props) {
  const [kind, setKind] = useState<BoxKind>(initial.kind);
  const [launchApp, setLaunchApp] = useState<LaunchAppValue>({
    appName: initial.appName ?? '',
    autoInsertWait: initial.autoInsertWait ?? true,
  });
  const [openUrl, setOpenUrl] = useState<OpenUrlValue>({
    url: initial.url ?? '',
    browser: initial.browser && initial.browser !== 'default' ? initial.browser : 'Google Chrome',
  });
  const [openTerminal, setOpenTerminal] = useState<OpenTerminalValue>({
    cwd: initial.cwd ?? '',
    command: initial.command ?? '',
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (kind === 'launchApp') {
      onSave({ kind, appName: launchApp.appName, autoInsertWait: launchApp.autoInsertWait });
    } else if (kind === 'openUrl') {
      onSave({ kind, url: openUrl.url, browser: openUrl.browser });
    } else {
      onSave({ kind, cwd: openTerminal.cwd, command: openTerminal.command || undefined });
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
        {kind === 'launchApp' && <LaunchAppFields value={launchApp} onChange={setLaunchApp} />}
        {kind === 'openUrl' && <OpenUrlFields value={openUrl} onChange={setOpenUrl} allowDefaultBrowser={false} />}
        {kind === 'openTerminal' && <OpenTerminalFields value={openTerminal} onChange={setOpenTerminal} />}
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
