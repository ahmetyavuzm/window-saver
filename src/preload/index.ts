import { contextBridge, ipcRenderer } from 'electron';
import type { Profile, Step } from '../shared/types.js';

const api = {
  listProfiles: (): Promise<Profile[]> => ipcRenderer.invoke('profiles:list'),
  getProfile: (id: string): Promise<Profile | undefined> => ipcRenderer.invoke('profiles:get', id),
  createProfile: (name: string): Promise<Profile> => ipcRenderer.invoke('profiles:create', name),
  updateProfile: (
    id: string,
    changes: Partial<Pick<Profile, 'name' | 'hotkey' | 'steps'>>,
  ): Promise<Profile | undefined> => ipcRenderer.invoke('profiles:update', id, changes),
  deleteProfile: (id: string): Promise<boolean> => ipcRenderer.invoke('profiles:delete', id),
  addStep: (profileId: string, step: Step): Promise<Profile | undefined> =>
    ipcRenderer.invoke('profiles:addStep', profileId, step),
  runProfile: (profileId: string): Promise<void> => ipcRenderer.invoke('profiles:run', profileId),
};

export type WindowSaverApi = typeof api;

contextBridge.exposeInMainWorld('windowSaver', api);
