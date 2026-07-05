import { useEffect, useState } from 'react';
import { useProfiles } from './hooks/useProfiles';
import { useDisplays } from './hooks/useDisplays';
import { useLayoutBoxes, addBoxSteps, updateBoxRect, deleteBox } from './hooks/useLayoutBoxes';
import { ProfileList } from './components/ProfileList';
import { StepList } from './components/StepList';
import { StepEditorForm } from './components/StepEditorForm';
import { LayoutCanvas } from './components/layout/LayoutCanvas';
import { WindowBox } from './components/layout/WindowBox';
import type { Step, RunResult } from '../shared/types';

export function App() {
  const { profiles, loading, createProfile, deleteProfile, setSteps, updateProfile, runProfile } = useProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [newBoxAppName, setNewBoxAppName] = useState('');
  const [newBoxDisplayId, setNewBoxDisplayId] = useState<number | null>(null);
  const displays = useDisplays();

  useEffect(() => {
    if (!selectedId && profiles.length > 0) setSelectedId(profiles[0].id);
    if (selectedId && !profiles.some((p) => p.id === selectedId)) {
      setSelectedId(profiles[0]?.id ?? null);
    }
  }, [profiles, selectedId]);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const layoutBoxes = useLayoutBoxes(selected?.steps ?? []);

  useEffect(() => {
    if (newBoxDisplayId === null && displays.length > 0) {
      setNewBoxDisplayId(displays[0].id);
    }
  }, [displays, newBoxDisplayId]);

  async function handleCreate(name: string) {
    await createProfile(name);
  }

  function handleStepsChange(steps: Step[]) {
    if (!selected) return;
    void setSteps(selected.id, steps);
  }

  function handleAddSteps(newSteps: Step[]) {
    if (!selected) return;
    void setSteps(selected.id, [...selected.steps, ...newSteps]);
  }

  async function handleHotkeyChange(hotkey: string) {
    if (!selected) return;
    if (hotkey) {
      const conflict = await window.windowSaver.checkHotkeyConflict(hotkey, selected.id);
      if (conflict) {
        window.alert(`"${hotkey}" is already in use by another profile or app.`);
        return;
      }
    }
    await updateProfile(selected.id, { hotkey: hotkey || undefined });
  }

  function handleAddBox() {
    if (!selected || !newBoxAppName.trim()) return;
    const display = displays.find((d) => d.id === newBoxDisplayId) ?? displays[0];
    if (!display) return;
    handleStepsChange(addBoxSteps(selected.steps, display, newBoxAppName.trim()));
    setNewBoxAppName('');
  }

  async function handleRun() {
    if (!selected) return;
    setRunning(true);
    setRunResult(null);
    const result = await runProfile(selected.id);
    setRunResult(result);
    setRunning(false);
  }

  if (loading) return <div className="app">Loading…</div>;

  return (
    <div className="app">
      <ProfileList
        profiles={profiles}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={handleCreate}
        onDelete={deleteProfile}
      />
      <div className="main-pane">
        {selected ? (
          <>
            <div className="profile-header">
              <h1>{selected.name}</h1>
              <input
                className="hotkey-input"
                placeholder="Hotkey (e.g. Cmd+Alt+1)"
                defaultValue={selected.hotkey ?? ''}
                onBlur={(e) => void handleHotkeyChange(e.target.value)}
              />
              <button disabled={running} onClick={() => void handleRun()}>
                {running ? 'Running…' : 'Run'}
              </button>
            </div>
            <div className="layout-canvas-wrap">
              <h2>Screens</h2>
              <div className="layout-canvas-toolbar">
                <select
                  value={newBoxDisplayId ?? ''}
                  onChange={(e) => setNewBoxDisplayId(Number(e.target.value))}
                >
                  {displays.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.isPrimary ? 'Primary' : `Display ${d.id}`} ({d.bounds.width}x{d.bounds.height})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="App name"
                  value={newBoxAppName}
                  onChange={(e) => setNewBoxAppName(e.target.value)}
                />
                <button onClick={handleAddBox} disabled={!newBoxAppName.trim()}>
                  Add window
                </button>
              </div>
              <LayoutCanvas
                displays={displays}
                renderBoxes={(display, scale) => (
                  <>
                    {layoutBoxes
                      .filter((box) => box.displayId === display.id)
                      .map((box) => (
                        <WindowBox
                          key={box.groupId}
                          rect={box.rect}
                          parentWidth={display.bounds.width * scale}
                          parentHeight={display.bounds.height * scale}
                          label={box.label}
                          onChange={(next) => {
                            if (!selected) return;
                            handleStepsChange(updateBoxRect(selected.steps, box.groupId, next));
                          }}
                          onDelete={() => {
                            if (!selected) return;
                            handleStepsChange(deleteBox(selected.steps, box.groupId));
                          }}
                        />
                      ))}
                  </>
                )}
              />
            </div>
            <StepList steps={selected.steps} onChange={handleStepsChange} />
            <StepEditorForm onAdd={handleAddSteps} />
            {runResult && (
              <div className={`run-console${runResult.ok ? '' : ' failed'}`}>
                <h3>Run log ({runResult.ok ? 'ok' : 'failed'})</h3>
                <ul>
                  {runResult.log.map((entry, i) => (
                    <li key={i} className={entry.status}>
                      [{entry.status}] {entry.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">Select or create a profile to get started.</div>
        )}
      </div>
    </div>
  );
}
