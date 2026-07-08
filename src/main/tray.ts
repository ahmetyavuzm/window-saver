import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { runProfile } from './engine/runner.js';
import { showEditorWindow } from './windows.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;

export function rebuildTrayMenu(): void {
  if (!tray) return;

  const profiles = store.listProfiles();
  const profileItems =
    profiles.length > 0
      ? profiles.map((profile) => ({
          label: profile.name,
          click: () => {
            // Fresh lookup: the menu item may outlive an edit to the profile.
            const fresh = store.getProfile(profile.id);
            if (fresh) void runProfile(fresh);
          },
        }))
      : [{ label: 'No profiles yet', enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: 'Window Saver', enabled: false },
    { type: 'separator' },
    ...profileItems,
    { type: 'separator' },
    { label: 'Manage Profiles…', click: () => showEditorWindow() },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]);
  tray.setContextMenu(menu);
}

export function createTray(): Tray {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'trayIconTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Window Saver');

  rebuildTrayMenu();

  return tray;
}
