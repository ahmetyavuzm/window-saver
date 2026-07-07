import { useState } from 'react';
import type { Step } from '../../shared/types';
import { LaunchAppFields, type LaunchAppValue } from './fields/LaunchAppFields';
import { OpenUrlFields, type OpenUrlValue } from './fields/OpenUrlFields';
import { OpenTerminalFields, type OpenTerminalValue } from './fields/OpenTerminalFields';

interface Props {
  onAdd: (steps: Step[]) => void;
}

type StepType = Step['type'];

const RECTANGLE_ACTIONS = [
  'left-half',
  'right-half',
  'top-half',
  'bottom-half',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'maximize',
  'center',
];

function newId(): string {
  return crypto.randomUUID();
}

export function StepEditorForm({ onAdd }: Props) {
  const [type, setType] = useState<StepType>('launchApp');
  const [appName, setAppName] = useState('');
  const [rectangleAction, setRectangleAction] = useState(RECTANGLE_ACTIONS[0]);
  const [windowTitle, setWindowTitle] = useState('');
  const [desktopIndex, setDesktopIndex] = useState('');
  const [ms, setMs] = useState(1000);
  const [launchApp, setLaunchApp] = useState<LaunchAppValue>({ appName: '', autoInsertWait: true });
  const [openUrl, setOpenUrl] = useState<OpenUrlValue>({ url: '', browser: 'default' });
  const [openTerminal, setOpenTerminal] = useState<OpenTerminalValue>({ cwd: '', command: '' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const steps: Step[] = [];

    if (type === 'launchApp') {
      steps.push({ type: 'launchApp', id: newId(), appName: launchApp.appName });
      if (launchApp.autoInsertWait) {
        steps.push({ type: 'waitForWindow', id: newId(), appName: launchApp.appName, timeoutMs: 8000 });
      }
    } else if (type === 'positionWindow') {
      steps.push({
        type: 'positionWindow',
        id: newId(),
        appName,
        rectangleAction,
        windowTitle: windowTitle || undefined,
        desktopIndex: desktopIndex ? Number(desktopIndex) : undefined,
      });
    } else if (type === 'openUrl') {
      steps.push({ type: 'openUrl', id: newId(), url: openUrl.url, browser: openUrl.browser });
    } else if (type === 'openTerminal') {
      steps.push({
        type: 'openTerminal',
        id: newId(),
        app: 'Terminal',
        cwd: openTerminal.cwd,
        command: openTerminal.command || undefined,
      });
    } else if (type === 'wait') {
      steps.push({ type: 'wait', id: newId(), ms });
    }

    onAdd(steps);
    setAppName('');
    setLaunchApp({ appName: '', autoInsertWait: true });
    setOpenUrl({ url: '', browser: 'default' });
    setOpenTerminal({ cwd: '', command: '' });
    setWindowTitle('');
    setDesktopIndex('');
  }

  return (
    <form className="step-editor-form" onSubmit={submit}>
      <select value={type} onChange={(e) => setType(e.target.value as StepType)}>
        <option value="launchApp">Launch App</option>
        <option value="positionWindow">Position Window</option>
        <option value="openUrl">Open URL</option>
        <option value="openTerminal">Open Terminal</option>
        <option value="wait">Wait</option>
      </select>

      {type === 'launchApp' && <LaunchAppFields value={launchApp} onChange={setLaunchApp} />}

      {type === 'positionWindow' && (
        <>
          <input placeholder="App name" value={appName} onChange={(e) => setAppName(e.target.value)} required />
          <select value={rectangleAction} onChange={(e) => setRectangleAction(e.target.value)}>
            {RECTANGLE_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          <input
            placeholder="Window title contains (optional, for multi-window apps)"
            value={windowTitle}
            onChange={(e) => setWindowTitle(e.target.value)}
          />
          <input
            type="number"
            min={1}
            placeholder="Desktop # on its screen (optional)"
            value={desktopIndex}
            onChange={(e) => setDesktopIndex(e.target.value)}
          />
        </>
      )}

      {type === 'openUrl' && <OpenUrlFields value={openUrl} onChange={setOpenUrl} />}

      {type === 'openTerminal' && <OpenTerminalFields value={openTerminal} onChange={setOpenTerminal} />}

      {type === 'wait' && (
        <input
          type="number"
          placeholder="Milliseconds"
          value={ms}
          onChange={(e) => setMs(Number(e.target.value))}
          required
        />
      )}

      <button type="submit">Add Step</button>
    </form>
  );
}
