import { ipcMain, globalShortcut, shell } from 'electron';
import * as store from './store.js';
import { runProfile } from './engine/runner.js';
import { rebuildTrayMenu } from './tray.js';
import { reregisterHotkeys } from './hotkeys.js';
import { checkPermissions, PERMISSION_SETTINGS_URLS } from './permissions.js';
import { listDisplays } from './displays.js';
import { listInstalledApps } from './apps.js';
import * as registry from './engine/registry.js';
import { terminateTarget } from './engine/terminate.js';
import { isYabaiAvailable, ensureSpacesOnDisplay } from './engine/yabai.js';
import { createDesktopViaMissionControl } from './engine/missioncontrol.js';
import { captureWindows, stepsFromCapturedWindows } from './engine/capture.js';
import type { CapturedWindow, Step, StopResult, UserSettings } from '../shared/types.js';

function onProfilesChanged(): void {
  rebuildTrayMenu();
  reregisterHotkeys();
}

export function registerIpcHandlers(): void {
  ipcMain.handle('profiles:list', () => store.listProfiles());
  ipcMain.handle('profiles:get', (_event, id: string) => store.getProfile(id));
  ipcMain.handle('profiles:create', (_event, name: string) => {
    const profile = store.createProfile(name);
    onProfilesChanged();
    return profile;
  });
  ipcMain.handle(
    'profiles:update',
    (_event, id: string, changes: Parameters<typeof store.updateProfile>[1]) => {
      const profile = store.updateProfile(id, changes);
      onProfilesChanged();
      return profile;
    },
  );
  ipcMain.handle('profiles:delete', (_event, id: string) => {
    const deleted = store.deleteProfile(id);
    onProfilesChanged();
    return deleted;
  });
  ipcMain.handle('profiles:addStep', (_event, profileId: string, step: Step) => {
    const profile = store.addStep(profileId, step);
    onProfilesChanged();
    return profile;
  });
  ipcMain.handle('profiles:run', async (_event, profileId: string) => {
    const profile = store.getProfile(profileId);
    if (!profile) return { profileId, ok: false, log: [], hasTrackedTargets: false };
    const createNewDesktop = store.getSettings().desktopMode === 'createNew';
    return runProfile(profile, { createNewDesktop });
  });
  ipcMain.handle('profiles:stop', async (_event, profileId: string): Promise<StopResult> => {
    const targets = registry.getTracked(profileId);
    const results = await Promise.all(targets.map((target) => terminateTarget(target)));
    // Cleared regardless of partial failures so Close never gets permanently stuck.
    registry.clear(profileId);
    return { profileId, ok: results.every((r) => r.closed), results };
  });

  ipcMain.handle('hotkeys:checkConflict', (_event, accelerator: string, ownerProfileId: string) => {
    const claimedByAnotherProfile = store
      .listProfiles()
      .some((p) => p.id !== ownerProfileId && p.hotkey === accelerator);
    if (claimedByAnotherProfile) return true;
    return globalShortcut.isRegistered(accelerator);
  });

  ipcMain.handle('permissions:check', () => checkPermissions());
  ipcMain.handle('permissions:openSettings', (_event, kind: 'accessibility' | 'automation') =>
    shell.openExternal(PERMISSION_SETTINGS_URLS[kind]),
  );
  ipcMain.handle('settings:completeOnboarding', () => store.setOnboardingComplete(true));
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', (_event, partial: Partial<UserSettings>) =>
    store.updateSettings(partial),
  );

  ipcMain.handle('displays:list', () => listDisplays());

  ipcMain.handle('apps:list', () => listInstalledApps());

  ipcMain.handle('yabai:isAvailable', () => isYabaiAvailable());

  ipcMain.handle(
    'desktops:ensureOnDisplay',
    (_event, displayBounds: { x: number; y: number }, target: number) =>
      ensureSpacesOnDisplay(displayBounds, target),
  );

  // SIP-free desktop creation via Mission Control's "+" (AX). Lands on the
  // active display; the user drags it/windows to the target screen.
  ipcMain.handle('desktops:createNew', () => createDesktopViaMissionControl());

  ipcMain.handle('windows:capture', () => captureWindows());

  ipcMain.handle('profiles:createFromWindows', (_event, name: string, windows: CapturedWindow[]) => {
    const profile = store.createProfile(name);
    for (const step of stepsFromCapturedWindows(windows)) {
      store.addStep(profile.id, step);
    }
    onProfilesChanged();
    return store.getProfile(profile.id);
  });
}
