import { useEffect, useState } from 'react';
import { useProfiles } from './hooks/useProfiles';
import { ProfileList } from './components/ProfileList';
import { StepList } from './components/StepList';
import { StepEditorForm } from './components/StepEditorForm';
import type { Step, RunResult } from '../shared/types';

export function App() {
  const { profiles, loading, createProfile, deleteProfile, setSteps, updateProfile, runProfile } = useProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!selectedId && profiles.length > 0) setSelectedId(profiles[0].id);
    if (selectedId && !profiles.some((p) => p.id === selectedId)) {
      setSelectedId(profiles[0]?.id ?? null);
    }
  }, [profiles, selectedId]);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

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
