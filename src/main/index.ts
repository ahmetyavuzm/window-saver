import { app, screen } from 'electron';
import { createTray } from './tray.js';
import { registerIpcHandlers } from './ipc.js';
import { reregisterHotkeys } from './hotkeys.js';
import { showOnboardingWindow, showEditorWindow, getEditorWindow } from './windows.js';
import { listDisplays } from './displays.js';
import * as store from './store.js';

// Two live instances mean two tray icons, duplicate global hotkeys, and both
// processes rewriting the same config.json. Hand off to the running one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', () => {
  showEditorWindow();
});

app.dock?.hide();

app.whenReady().then(() => {
  createTray();
  registerIpcHandlers();
  reregisterHotkeys();

  if (!store.getSettings().onboardingComplete) {
    showOnboardingWindow();
  }

  const broadcastDisplays = () => {
    const win = getEditorWindow();
    win?.webContents.send('displays:changed', listDisplays());
  };
  screen.on('display-added', broadcastDisplays);
  screen.on('display-removed', broadcastDisplays);
  screen.on('display-metrics-changed', broadcastDisplays);
});

app.on('window-all-closed', () => {
  // Tray-only app: never quit just because there are no windows.
});
