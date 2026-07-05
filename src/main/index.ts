import { app } from 'electron';
import { createTray } from './tray.js';
import { registerIpcHandlers } from './ipc.js';
import { reregisterHotkeys } from './hotkeys.js';
import { showOnboardingWindow } from './windows.js';
import * as store from './store.js';

app.dock?.hide();

app.whenReady().then(() => {
  createTray();
  registerIpcHandlers();
  reregisterHotkeys();

  if (!store.getSettings().onboardingComplete) {
    showOnboardingWindow();
  }
});

app.on('window-all-closed', () => {
  // Tray-only app: never quit just because there are no windows.
});
