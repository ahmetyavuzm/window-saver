import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import type { Profile, StoreSchema, Step } from '../shared/types.js';

const CURRENT_SCHEMA_VERSION = 2;

const store = new Store<StoreSchema>({
  name: 'config',
  defaults: {
    profiles: [],
    settings: {
      onboardingComplete: false,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
  },
});

migrateStore();

/**
 * v1 -> v2 is purely additive (positionWindow.placement, groupId on several step
 * types) so existing profiles already satisfy the v2 shape as-is. This just bumps
 * the stored version and establishes the pattern for future, non-trivial migrations.
 */
function migrateStore(): void {
  const settings = store.get('settings');
  if (settings.schemaVersion >= CURRENT_SCHEMA_VERSION) return;
  store.set('settings', { ...settings, schemaVersion: CURRENT_SCHEMA_VERSION });
}

export function listProfiles(): Profile[] {
  return store.get('profiles');
}

export function getProfile(id: string): Profile | undefined {
  return listProfiles().find((p) => p.id === id);
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
  const profiles = listProfiles();
  profiles.push(profile);
  store.set('profiles', profiles);
  return profile;
}

export function updateProfile(
  id: string,
  changes: Partial<Pick<Profile, 'name' | 'hotkey' | 'steps'>>,
): Profile | undefined {
  const profiles = listProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  const updated: Profile = {
    ...profiles[index],
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  profiles[index] = updated;
  store.set('profiles', profiles);
  return updated;
}

export function deleteProfile(id: string): boolean {
  const profiles = listProfiles();
  const next = profiles.filter((p) => p.id !== id);
  const changed = next.length !== profiles.length;
  if (changed) store.set('profiles', next);
  return changed;
}

export function addStep(profileId: string, step: Step): Profile | undefined {
  const profile = getProfile(profileId);
  if (!profile) return undefined;
  return updateProfile(profileId, { steps: [...profile.steps, step] });
}

export function getSettings(): StoreSchema['settings'] {
  return store.get('settings');
}

export function setOnboardingComplete(complete: boolean): void {
  store.set('settings', { ...getSettings(), onboardingComplete: complete });
}

export function storeFilePath(): string {
  return store.path;
}
