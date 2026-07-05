import { systemPreferences } from 'electron';
import { runAppleScript } from './engine/applescript.js';
import type { PermissionStatus } from '../shared/types.js';

export const PERMISSION_SETTINGS_URLS: Record<'accessibility' | 'automation', string> = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  automation: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
};

export async function checkPermissions(): Promise<PermissionStatus> {
  const accessibility = systemPreferences.isTrustedAccessibilityClient(false);

  let automation = true;
  try {
    // Harmless no-op AppleScript: succeeds only if Automation permission for
    // System Events has already been granted (or triggers the OS prompt on first run).
    await runAppleScript('tell application "System Events" to return name of first process');
  } catch {
    automation = false;
  }

  return { accessibility, automation };
}
