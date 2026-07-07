import { useEffect, useState } from 'react';
import { useProfiles } from './hooks/useProfiles';
import { useDisplays } from './hooks/useDisplays';
import { useSettings } from './hooks/useSettings';
import {
  useLayoutBoxes,
  createBoxSteps,
  updateBoxConfig,
  updateBoxRect,
  updateBoxDesktop,
  deleteBox,
  type BoxConfig,
} from './hooks/useLayoutBoxes';
import { ProfileList } from './components/ProfileList';
import { StepList } from './components/StepList';
import { StepEditorForm } from './components/StepEditorForm';
import { LayoutCanvas } from './components/layout/LayoutCanvas';
import { WindowBox } from './components/layout/WindowBox';
import { BoxConfigPanel } from './components/layout/BoxConfigPanel';
import { DesktopTabs, type DesktopSelection } from './components/layout/DesktopTabs';
import { SettingsPanel } from './components/settings/SettingsPanel';
import type { Step, RunResult, DisplayInfo } from '../shared/types';

const DEFAULT_NEW_BOX_CONFIG: BoxConfig = { kind: 'launchApp', appName: '', autoInsertWait: true };

// Desktops are per-display: each screen has its own Desktop 1,2,3…. Desktop 1
// (and "All") is the default with no yabai Space move → stored desktopIndex
// undefined; Desktop N>1 stores N and is resolved to a global Space at run time.
function activeToStored(d: DesktopSelection): number | undefined {
  return d === 'all' || d === 1 ? undefined : d;
}
const boxDesktop = (desktopIndex?: number): number => desktopIndex ?? 1;

interface ConfigTarget {
  groupId: string | null; // null = creating a new box
  display: DisplayInfo;
  config: BoxConfig;
  desktopIndex?: number; // current desktop of an existing box (within its display)
}

export function App() {
  const { profiles, loading, createProfile, deleteProfile, setSteps, updateProfile, runProfile, stopProfile } =
    useProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [hasTrackedTargets, setHasTrackedTargets] = useState(false);
  const [newBoxDisplayId, setNewBoxDisplayId] = useState<number | null>(null);
  const [configTarget, setConfigTarget] = useState<ConfigTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Active desktop tab and highest user-added empty desktop, both keyed by
  // display id (missing key ⇒ Desktop 1).
  const [activeDesktopByDisplay, setActiveDesktopByDisplay] = useState<Record<number, DesktopSelection>>({});
  const [addedDesktopsByDisplay, setAddedDesktopsByDisplay] = useState<Record<number, number>>({});
  const [yabaiAvailable, setYabaiAvailable] = useState<boolean | null>(null);
  const displays = useDisplays();
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    void window.windowSaver.isYabaiAvailable().then(setYabaiAvailable);
  }, []);

  useEffect(() => {
    if (!selectedId && profiles.length > 0) setSelectedId(profiles[0].id);
    if (selectedId && !profiles.some((p) => p.id === selectedId)) {
      setSelectedId(profiles[0]?.id ?? null);
    }
  }, [profiles, selectedId]);

  useEffect(() => {
    // Tracked targets live in the main process keyed by profileId; this
    // renderer-side flag must reset on profile switch so Close doesn't
    // linger for a profile that was never run in this session.
    setHasTrackedTargets(false);
    // Desktop view is per-profile; reset it when switching.
    setActiveDesktopByDisplay({});
    setAddedDesktopsByDisplay({});
  }, [selectedId]);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const layoutBoxes = useLayoutBoxes(selected?.steps ?? []);

  const activeDesktopFor = (id: number): DesktopSelection => activeDesktopByDisplay[id] ?? 1;
  const boxesOnDisplay = (id: number) => layoutBoxes.filter((b) => b.displayId === id);
  // Desktop tabs for a display: 1..max(boxes' desktop, user-added, active tab).
  const maxDesktopFor = (id: number): number => {
    const active = activeDesktopByDisplay[id];
    return Math.max(
      addedDesktopsByDisplay[id] ?? 1,
      ...boxesOnDisplay(id).map((b) => boxDesktop(b.desktopIndex)),
      typeof active === 'number' ? active : 1,
    );
  };
  const desktopsFor = (id: number): number[] => Array.from({ length: maxDesktopFor(id) }, (_, i) => i + 1);
  // Only the top desktop may be removed, and only when it holds no boxes.
  const deletableDesktopFor = (id: number): number | undefined => {
    const top = maxDesktopFor(id);
    if (top <= 1) return undefined;
    const occupied = boxesOnDisplay(id).some((b) => boxDesktop(b.desktopIndex) === top);
    return occupied ? undefined : top;
  };
  const boxVisibleOnDisplay = (box: { displayId: number; desktopIndex?: number }): boolean => {
    const active = activeDesktopFor(box.displayId);
    return active === 'all' || boxDesktop(box.desktopIndex) === active;
  };

  // Multi-desktop needs yabai; warn only when the profile actually uses it.
  const usesMultiDesktop =
    layoutBoxes.some((b) => boxDesktop(b.desktopIndex) > 1) ||
    Object.values(addedDesktopsByDisplay).some((n) => n > 1);
  const showYabaiWarning = yabaiAvailable === false && usesMultiDesktop;

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
    const display = displays.find((d) => d.id === newBoxDisplayId) ?? displays[0];
    if (!display) return;
    setConfigTarget({ groupId: null, display, config: DEFAULT_NEW_BOX_CONFIG });
  }

  function handleSaveConfig(config: BoxConfig) {
    if (!selected || !configTarget) return;
    if (configTarget.groupId === null) {
      // New boxes inherit the active desktop of the display they're placed on.
      const desktopIndex = activeToStored(activeDesktopFor(configTarget.display.id));
      handleStepsChange(createBoxSteps(selected.steps, configTarget.display, config, desktopIndex));
    } else {
      handleStepsChange(updateBoxConfig(selected.steps, configTarget.groupId, config));
    }
    setConfigTarget(null);
  }

  function setActiveDesktop(displayId: number, sel: DesktopSelection) {
    setActiveDesktopByDisplay((prev) => ({ ...prev, [displayId]: sel }));
  }

  function handleAddDesktop(displayId: number) {
    const next = maxDesktopFor(displayId) + 1;
    setAddedDesktopsByDisplay((prev) => ({ ...prev, [displayId]: next }));
    setActiveDesktopByDisplay((prev) => ({ ...prev, [displayId]: next }));
  }

  function handleDeleteDesktop(displayId: number, d: number) {
    if (deletableDesktopFor(displayId) !== d) return; // guard: only top & empty
    const fallback = d - 1;
    setAddedDesktopsByDisplay((prev) => ({ ...prev, [displayId]: fallback }));
    setActiveDesktopByDisplay((prev) => ({
      ...prev,
      [displayId]: prev[displayId] === d ? fallback : prev[displayId] ?? 1,
    }));
  }

  async function handleRun() {
    if (!selected) return;
    setRunning(true);
    setRunResult(null);
    const result = await runProfile(selected.id);
    setRunResult(result);
    setRunning(false);
    setHasTrackedTargets(result.hasTrackedTargets);
  }

  async function handleStop() {
    if (!selected) return;
    setStopping(true);
    const stopResult = await stopProfile(selected.id);
    setRunResult((prev) => {
      const stopLog = stopResult.results.map((r) => ({
        stepId: 'stop',
        status: (r.closed ? 'ok' : 'error') as 'ok' | 'error',
        message: `Closed ${r.label}: ${r.method}`,
        timestamp: new Date().toISOString(),
      }));
      if (!prev) return { profileId: selected.id, ok: stopResult.ok, log: stopLog, hasTrackedTargets: false };
      return { ...prev, log: [...prev.log, ...stopLog] };
    });
    setHasTrackedTargets(false);
    setStopping(false);
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
        onOpenSettings={() => setSettingsOpen(true)}
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
              {hasTrackedTargets && (
                <button disabled={stopping} onClick={() => void handleStop()}>
                  {stopping ? 'Closing…' : 'Close'}
                </button>
              )}
            </div>
            <div className="layout-canvas-wrap">
              <h2>Screens</h2>
              {displays.length > 0 && (
                <div className="desktop-tabs-panel">
                  {displays.map((d) => (
                    <div className="desktop-tabs-row" key={d.id}>
                      <span className="desktop-tabs-screen">
                        {d.isPrimary ? 'Primary' : `Display ${d.id}`}
                      </span>
                      <DesktopTabs
                        desktops={desktopsFor(d.id)}
                        active={activeDesktopFor(d.id)}
                        deletableDesktop={deletableDesktopFor(d.id)}
                        onSelect={(sel) => setActiveDesktop(d.id, sel)}
                        onAdd={() => handleAddDesktop(d.id)}
                        onDelete={(dd) => handleDeleteDesktop(d.id, dd)}
                      />
                    </div>
                  ))}
                </div>
              )}
              {showYabaiWarning && (
                <div className="yabai-banner" role="alert">
                  Multi-desktop placement needs <strong>yabai</strong>. Install it and grant Accessibility,
                  or these windows will stay on the current desktop.
                </div>
              )}
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
                <button onClick={handleAddBox} disabled={!displays.length}>
                  Add window
                </button>
              </div>
              <LayoutCanvas
                displays={displays}
                renderBoxes={(display, scale) => (
                  <>
                    {boxesOnDisplay(display.id)
                      .filter((box) => boxVisibleOnDisplay(box))
                      .map((box) => (
                        <WindowBox
                          key={box.groupId}
                          rect={box.rect}
                          parentWidth={display.workArea.width * scale}
                          parentHeight={display.workArea.height * scale}
                          label={box.label}
                          onClick={() =>
                            setConfigTarget({
                              groupId: box.groupId,
                              display,
                              config: box.config,
                              desktopIndex: box.desktopIndex,
                            })
                          }
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
            {configTarget && (
              <BoxConfigPanel
                initial={configTarget.config}
                onSave={handleSaveConfig}
                onCancel={() => setConfigTarget(null)}
                onDelete={
                  configTarget.groupId
                    ? () => {
                        if (!selected || !configTarget.groupId) return;
                        handleStepsChange(deleteBox(selected.steps, configTarget.groupId));
                        setConfigTarget(null);
                      }
                    : undefined
                }
                desktops={configTarget.groupId ? desktopsFor(configTarget.display.id) : undefined}
                desktop={configTarget.groupId ? boxDesktop(configTarget.desktopIndex) : undefined}
                onDesktopChange={
                  configTarget.groupId
                    ? (d) => {
                        if (!selected || !configTarget.groupId) return;
                        handleStepsChange(
                          updateBoxDesktop(selected.steps, configTarget.groupId, d === 1 ? undefined : d),
                        );
                        setConfigTarget((prev) => (prev ? { ...prev, desktopIndex: d === 1 ? undefined : d } : prev));
                      }
                    : undefined
                }
              />
            )}
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
      {settingsOpen && settings && (
        <SettingsPanel
          settings={{ theme: settings.theme, accentColor: settings.accentColor }}
          onUpdate={(partial) => void updateSettings(partial)}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
