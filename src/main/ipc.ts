import { ipcMain } from 'electron';
import * as store from './store.js';
import type { Step } from '../shared/types.js';

export function registerIpcHandlers(): void {
  ipcMain.handle('profiles:list', () => store.listProfiles());
  ipcMain.handle('profiles:get', (_event, id: string) => store.getProfile(id));
  ipcMain.handle('profiles:create', (_event, name: string) => store.createProfile(name));
  ipcMain.handle(
    'profiles:update',
    (_event, id: string, changes: Parameters<typeof store.updateProfile>[1]) =>
      store.updateProfile(id, changes),
  );
  ipcMain.handle('profiles:delete', (_event, id: string) => store.deleteProfile(id));
  ipcMain.handle('profiles:addStep', (_event, profileId: string, step: Step) =>
    store.addStep(profileId, step),
  );
}
