import { useState } from 'react';
import type { Step } from '../../shared/types';

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
  const [spaceIndex, setSpaceIndex] = useState('');
  const [url, setUrl] = useState('');
  const [browser, setBrowser] = useState<'default' | 'Google Chrome' | 'Safari' | 'Arc'>('default');
  const [cwd, setCwd] = useState('');
  const [command, setCommand] = useState('');
  const [ms, setMs] = useState(1000);
  const [autoInsertWait, setAutoInsertWait] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const steps: Step[] = [];

    if (type === 'launchApp') {
      steps.push({ type: 'launchApp', id: newId(), appName });
      if (autoInsertWait) {
        steps.push({ type: 'waitForWindow', id: newId(), appName, timeoutMs: 8000 });
      }
    } else if (type === 'positionWindow') {
      steps.push({
        type: 'positionWindow',
        id: newId(),
        appName,
        rectangleAction,
        windowTitle: windowTitle || undefined,
        spaceIndex: spaceIndex ? Number(spaceIndex) : undefined,
      });
    } else if (type === 'openUrl') {
      steps.push({ type: 'openUrl', id: newId(), url, browser });
    } else if (type === 'openTerminal') {
      steps.push({ type: 'openTerminal', id: newId(), app: 'Terminal', cwd, command: command || undefined });
    } else if (type === 'wait') {
      steps.push({ type: 'wait', id: newId(), ms });
    }

    onAdd(steps);
    setAppName('');
    setUrl('');
    setCwd('');
    setCommand('');
    setWindowTitle('');
    setSpaceIndex('');
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

      {type === 'launchApp' && (
        <>
          <input placeholder="App name (e.g. Slack)" value={appName} onChange={(e) => setAppName(e.target.value)} required />
          <label className="checkbox">
            <input type="checkbox" checked={autoInsertWait} onChange={(e) => setAutoInsertWait(e.target.checked)} />
            Wait for window afterward
          </label>
        </>
      )}

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
            placeholder="Move to desktop/Space # (optional)"
            value={spaceIndex}
            onChange={(e) => setSpaceIndex(e.target.value)}
          />
        </>
      )}

      {type === 'openUrl' && (
        <>
          <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} required />
          <select value={browser} onChange={(e) => setBrowser(e.target.value as typeof browser)}>
            <option value="default">Default browser</option>
            <option value="Google Chrome">Google Chrome</option>
            <option value="Safari">Safari</option>
            <option value="Arc">Arc</option>
          </select>
        </>
      )}

      {type === 'openTerminal' && (
        <>
          <input placeholder="Working directory" value={cwd} onChange={(e) => setCwd(e.target.value)} required />
          <input placeholder="Command (optional, e.g. claude)" value={command} onChange={(e) => setCommand(e.target.value)} />
        </>
      )}

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
