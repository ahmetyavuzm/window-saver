import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let editorWindow: BrowserWindow | null = null;
let onboardingWindow: BrowserWindow | null = null;

export function showOnboardingWindow(): BrowserWindow {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.show();
    onboardingWindow.focus();
    return onboardingWindow;
  }

  onboardingWindow = new BrowserWindow({
    width: 480,
    height: 420,
    title: 'Window Saver — Setup',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  onboardingWindow.setMenuBarVisibility(false);
  onboardingWindow.loadFile(path.join(__dirname, '..', '..', 'resources', 'onboarding.html'));

  onboardingWindow.on('closed', () => {
    onboardingWindow = null;
  });

  return onboardingWindow;
}

export function getEditorWindow(): BrowserWindow | null {
  return editorWindow && !editorWindow.isDestroyed() ? editorWindow : null;
}

export function showEditorWindow(): BrowserWindow {
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.show();
    editorWindow.focus();
    return editorWindow;
  }

  editorWindow = new BrowserWindow({
    width: 900,
    height: 640,
    title: 'Window Saver — Manage Profiles',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  editorWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  return editorWindow;
}
