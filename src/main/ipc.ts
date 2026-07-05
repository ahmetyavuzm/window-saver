import { ipcMain } from 'electron';
import * as store from './store.js';
import { runProfile } from './engine/runner.js';
import { rebuildTrayMenu } from './tray.js';
import type { Step } from '../shared/types.js';

export function registerIpcHandlers(): void {
  ipcMain.handle('profiles:list', () => store.listProfiles());
  ipcMain.handle('profiles:get', (_event, id: string) => store.getProfile(id));
  ipcMain.handle('profiles:create', (_event, name: string) => {
    const profile = store.createProfile(name);
    rebuildTrayMenu();
    return profile;
  });
  ipcMain.handle(
    'profiles:update',
    (_event, id: string, changes: Parameters<typeof store.updateProfile>[1]) => {
      const profile = store.updateProfile(id, changes);
      rebuildTrayMenu();
      return profile;
    },
  );
  ipcMain.handle('profiles:delete', (_event, id: string) => {
    const deleted = store.deleteProfile(id);
    rebuildTrayMenu();
    return deleted;
  });
  ipcMain.handle('profiles:addStep', (_event, profileId: string, step: Step) => {
    const profile = store.addStep(profileId, step);
    rebuildTrayMenu();
    return profile;
  });
  ipcMain.handle('profiles:run', async (_event, profileId: string) => {
    const profile = store.getProfile(profileId);
    if (!profile) return { profileId, ok: false, log: [] };
    return runProfile(profile);
  });
}
