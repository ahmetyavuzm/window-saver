import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Profile, Settings, StoreSchema, Step, UserSettings } from '../shared/types.js';

const CURRENT_SCHEMA_VERSION = 6;

const DEFAULT_SETTINGS: Settings = {
  onboardingComplete: false,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  theme: 'system',
  accentColor: '#0a84ff',
  desktopLayout: 'grid',
  desktopMode: 'reuse',
};

// Same file electron-store used to write, so stores from older versions are
// picked up unchanged.
const storeFile = path.join(app.getPath('userData'), 'config.json');

function loadStore(): StoreSchema {
  try {
    const raw = JSON.parse(readFileSync(storeFile, 'utf8')) as Partial<StoreSchema>;
    // Missing settings fields are filled by migrateStore's DEFAULT_SETTINGS spread.
    return { profiles: raw.profiles ?? [], settings: raw.settings ?? { ...DEFAULT_SETTINGS } };
  } catch {
    return { profiles: [], settings: { ...DEFAULT_SETTINGS } }; // first run / unreadable file
  }
}

const data = loadStore();
migrateStore();

function persist(): void {
  mkdirSync(path.dirname(storeFile), { recursive: true });
  // Write-then-rename so a crash mid-write can never corrupt config.json.
  const tmp = `${storeFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, storeFile);
}

/**
 * Migrations here are purely additive:
 *  - v1 -> v2: positionWindow.placement + groupId on several step types (existing
 *    profiles already satisfy the shape).
 *  - v2 -> v3: theme + accentColor settings. Fill any missing fields from
 *    DEFAULT_SETTINGS so stores written by an older version get sane values.
 *  - v3 -> v4: positionWindow.spaceIndex (a raw global yabai Space index) becomes
 *    desktopIndex (a per-display, 1-based desktop resolved to the real global Space
 *    at run time). Carry the number over — single-display setups stay correct; any
 *    pre-existing multi-display assignment may point at a different desktop and can
 *    be reassigned from the UI.
 *  - v4 -> v5: desktopLayout setting ('tabs' | 'grid'). Purely additive — the
 *    DEFAULT_SETTINGS spread below fills the default ('grid') for any store
 *    written before v5.
 *  - v5 -> v6: desktopMode setting ('reuse' | 'createNew'). Additive — the spread
 *    fills the default ('reuse'), preserving prior behavior.
 */
function migrateStore(): void {
  if (data.settings.schemaVersion >= CURRENT_SCHEMA_VERSION) return;

  if (data.settings.schemaVersion < 4) {
    for (const profile of data.profiles) {
      for (const step of profile.steps as Array<Step & { spaceIndex?: number }>) {
        if (step.type !== 'positionWindow') continue;
        if (step.spaceIndex === undefined) continue;
        if (step.desktopIndex === undefined) step.desktopIndex = step.spaceIndex;
        delete step.spaceIndex;
      }
    }
  }

  data.settings = { ...DEFAULT_SETTINGS, ...data.settings, schemaVersion: CURRENT_SCHEMA_VERSION };
  persist();
}

export function listProfiles(): Profile[] {
  return data.profiles;
}

export function getProfile(id: string): Profile | undefined {
  return data.profiles.find((p) => p.id === id);
}

export function createProfile(name: string): Profile {
  const now = new Date().toISOString();
  const profile: Profile = {
    id: randomUUID(),
    name,
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
  data.profiles.push(profile);
  persist();
  return profile;
}

export function updateProfile(
  id: string,
  changes: Partial<Pick<Profile, 'name' | 'hotkey' | 'steps'>>,
): Profile | undefined {
  const index = data.profiles.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  const updated: Profile = {
    ...data.profiles[index],
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  data.profiles[index] = updated;
  persist();
  return updated;
}

export function deleteProfile(id: string): boolean {
  const next = data.profiles.filter((p) => p.id !== id);
  const changed = next.length !== data.profiles.length;
  if (changed) {
    data.profiles = next;
    persist();
  }
  return changed;
}

export function addStep(profileId: string, step: Step): Profile | undefined {
  const profile = getProfile(profileId);
  if (!profile) return undefined;
  return updateProfile(profileId, { steps: [...profile.steps, step] });
}

export function getSettings(): Settings {
  return data.settings;
}

export function updateSettings(partial: Partial<UserSettings>): Settings {
  data.settings = { ...data.settings, ...partial };
  persist();
  return data.settings;
}

export function setOnboardingComplete(complete: boolean): void {
  data.settings = { ...data.settings, onboardingComplete: complete };
  persist();
}
