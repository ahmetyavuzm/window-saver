import type {
  Profile,
  Step,
  RunResult,
  PermissionStatus,
  DisplayInfo,
  StopResult,
  Settings,
  UserSettings,
} from '../shared/types';

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
  stopProfile(profileId: string): Promise<StopResult>;
  checkHotkeyConflict(accelerator: string, ownerProfileId: string): Promise<boolean>;
  checkPermissions(): Promise<PermissionStatus>;
  openPermissionSettings(kind: 'accessibility' | 'automation'): Promise<void>;
  completeOnboarding(): Promise<void>;
  getSettings(): Promise<Settings>;
  updateSettings(partial: Partial<UserSettings>): Promise<Settings>;
  listDisplays(): Promise<DisplayInfo[]>;
  onDisplaysChanged(cb: (displays: DisplayInfo[]) => void): () => void;
}

declare global {
  interface Window {
    windowSaver: WindowSaverApi;
  }
}
