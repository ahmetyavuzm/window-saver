import { contextBridge, ipcRenderer } from 'electron';
import type {
  Profile,
  Step,
  PermissionStatus,
  DisplayInfo,
  StopResult,
  Settings,
  UserSettings,
  CapturedWindow,
  YabaiInstallResult,
} from '../shared/types.js';

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
  stopProfile: (profileId: string): Promise<StopResult> => ipcRenderer.invoke('profiles:stop', profileId),
  checkHotkeyConflict: (accelerator: string, ownerProfileId: string): Promise<boolean> =>
    ipcRenderer.invoke('hotkeys:checkConflict', accelerator, ownerProfileId),
  checkPermissions: (): Promise<PermissionStatus> => ipcRenderer.invoke('permissions:check'),
  openPermissionSettings: (kind: 'accessibility' | 'automation'): Promise<void> =>
    ipcRenderer.invoke('permissions:openSettings', kind),
  completeOnboarding: (): Promise<void> => ipcRenderer.invoke('settings:completeOnboarding'),
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<UserSettings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:update', partial),
  listDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('displays:list'),
  listApps: (): Promise<string[]> => ipcRenderer.invoke('apps:list'),
  isYabaiAvailable: (): Promise<boolean> => ipcRenderer.invoke('yabai:isAvailable'),
  installYabai: (): Promise<YabaiInstallResult> => ipcRenderer.invoke('yabai:install'),
  ensureDesktops: (
    displayBounds: { x: number; y: number },
    target: number,
  ): Promise<{ created: number; needsScriptingAddition: boolean }> =>
    ipcRenderer.invoke('desktops:ensureOnDisplay', displayBounds, target),
  createDesktop: (): Promise<{ created: boolean; error?: string }> =>
    ipcRenderer.invoke('desktops:createNew'),
  captureWindows: (): Promise<CapturedWindow[]> => ipcRenderer.invoke('windows:capture'),
  createProfileFromWindows: (name: string, windows: CapturedWindow[]): Promise<Profile | undefined> =>
    ipcRenderer.invoke('profiles:createFromWindows', name, windows),
  onDisplaysChanged: (cb: (displays: DisplayInfo[]) => void): (() => void) => {
    const listener = (_event: unknown, displays: DisplayInfo[]) => cb(displays);
    ipcRenderer.on('displays:changed', listener);
    return () => ipcRenderer.removeListener('displays:changed', listener);
  },
};

export type WindowSaverApi = typeof api;

contextBridge.exposeInMainWorld('windowSaver', api);
