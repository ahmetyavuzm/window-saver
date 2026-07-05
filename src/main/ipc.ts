import { ipcMain, globalShortcut, shell } from 'electron';
import * as store from './store.js';
import { runProfile } from './engine/runner.js';
import { rebuildTrayMenu } from './tray.js';
import { reregisterHotkeys } from './hotkeys.js';
import { checkPermissions, PERMISSION_SETTINGS_URLS } from './permissions.js';
import { listDisplays } from './displays.js';
import type { Step } from '../shared/types.js';

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
    if (!profile) return { profileId, ok: false, log: [] };
    return runProfile(profile);
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

  ipcMain.handle('displays:list', () => listDisplays());
}
