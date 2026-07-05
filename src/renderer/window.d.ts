import type { Profile, Step, RunResult, PermissionStatus, DisplayInfo } from '../shared/types';

export interface WindowSaverApi {
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | undefined>;
  createProfile(name: string): Promise<Profile>;
  updateProfile(
    id: string,
    changes: Partial<Pick<Profile, 'name' | 'hotkey' | 'steps'>>,
  ): Promise<Profile | undefined>;
  deleteProfile(id: string): Promise<boolean>;
  addStep(profileId: string, step: Step): Promise<Profile | undefined>;
  runProfile(profileId: string): Promise<RunResult>;
  checkHotkeyConflict(accelerator: string, ownerProfileId: string): Promise<boolean>;
  checkPermissions(): Promise<PermissionStatus>;
  openPermissionSettings(kind: 'accessibility' | 'automation'): Promise<void>;
  completeOnboarding(): Promise<void>;
  listDisplays(): Promise<DisplayInfo[]>;
  onDisplaysChanged(cb: (displays: DisplayInfo[]) => void): () => void;
}

declare global {
  interface Window {
    windowSaver: WindowSaverApi;
  }
}
