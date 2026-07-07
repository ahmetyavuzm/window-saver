import type { BoxAction } from '../shared/types';

// Friendly, app-specific actions a box can run after launch+placement.
// macOS has no universal API for "an app's action list" — this is a small,
// curated catalog we ship (proof of concept: Spotify, VS Code, Chrome).
// Uncatalogued apps fall back to the generic actions below.
export interface CatalogAction {
  label: string;
  kind: BoxAction['kind'];
  script?: string; // appleScript
  placeholder?: string; // openTarget: prompts the user for the value (path/URI)
  ms?: number; // wait default
}

export const ACTION_CATALOG: Record<string, CatalogAction[]> = {
  Spotify: [
    { label: 'Play/Pause', kind: 'appleScript', script: 'tell application "Spotify" to playpause' },
    { label: 'Next Track', kind: 'appleScript', script: 'tell application "Spotify" to next track' },
    { label: 'Previous Track', kind: 'appleScript', script: 'tell application "Spotify" to previous track' },
    { label: 'Play URI…', kind: 'openTarget', placeholder: 'spotify:track:...' },
  ],
  'Visual Studio Code': [{ label: 'Open Folder…', kind: 'openTarget', placeholder: '/path/to/folder' }],
  'Google Chrome': [{ label: 'Open URL in New Tab…', kind: 'openTarget', placeholder: 'https://…' }],
};

export const GENERIC_ACTIONS: CatalogAction[] = [
  { label: 'Open path/URI…', kind: 'openTarget', placeholder: '/path or a URI' },
  { label: 'Run AppleScript…', kind: 'appleScript', script: '' },
  { label: 'Wait…', kind: 'wait', ms: 1000 },
];

export function catalogActionsFor(appName: string | undefined): CatalogAction[] {
  return (appName && ACTION_CATALOG[appName]) || [];
}
