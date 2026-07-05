import { app } from 'electron';
import { createTray } from './tray.js';

app.dock?.hide();

app.whenReady().then(() => {
  createTray();
});

app.on('window-all-closed', () => {
  // Tray-only app: never quit just because there are no windows.
});
