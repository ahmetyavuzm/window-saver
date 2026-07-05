import { globalShortcut } from 'electron';
import * as store from './store.js';
import { runProfile } from './engine/runner.js';

export function reregisterHotkeys(): void {
  globalShortcut.unregisterAll();

  for (const profile of store.listProfiles()) {
    if (!profile.hotkey) continue;

    const ok = globalShortcut.register(profile.hotkey, () => {
      void runProfile(profile);
    });

    if (!ok) {
      console.error(`Failed to register hotkey "${profile.hotkey}" for profile "${profile.name}" (likely already in use)`);
    }
  }
}
