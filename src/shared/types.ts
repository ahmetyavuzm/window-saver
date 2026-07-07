export interface DisplayRef {
  displayId: number;
  widthPx: number;
  heightPx: number;
}

/** 0..1, relative to the target display's workArea (menu bar/dock already excluded). */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowPlacement {
  display: DisplayRef;
  rect: NormalizedRect;
}

/**
 * A single post-launch action run against a box's app. `label` is the
 * friendly text shown in the UI (from the app-action catalog or typed by the
 * user for a generic action).
 *  - 'openTarget': `open -a <box's appName> <value>` — value is a file/folder
 *    path or a URI (custom scheme like `spotify:track:…`, or a plain URL).
 *  - 'appleScript': raw script run via osascript (catalog actions hide this
 *    behind a friendly label, e.g. Spotify Play/Pause).
 *  - 'wait': pause before the next action.
 */
export type BoxAction =
  | { id: string; kind: 'openTarget'; label: string; value: string }
  | { id: string; kind: 'appleScript'; label: string; script: string }
  | { id: string; kind: 'wait'; label: string; ms: number };

export type Step =
  | {
      type: 'launchApp';
      id: string;
      appName: string;
      bundleId?: string;
      args?: string[];
      /**
       * Force a new instance/window even if the app is already running
       * (`open -n`). Default false: `open` just brings the running app forward,
       * and positionWindow re-uses its existing window.
       */
      openNewWindow?: boolean;
      groupId?: string;
    }
  | { type: 'waitForWindow'; id: string; appName: string; timeoutMs?: number; groupId?: string }
  | {
      type: 'positionWindow';
      id: string;
      appName: string;
      rectangleAction?: string;
      placement?: WindowPlacement;
      windowTitle?: string;
      /**
       * Target desktop (macOS Space) **within this step's own display**, 1-based.
       * undefined or 1 = leave the window on that display's current Space; ≥2 =
       * move it to that display's Nth Space, resolved to yabai's global index at
       * run time (global indices shift when desktops/displays change).
       */
      desktopIndex?: number;
      /**
       * Open the window filling its target display instead of applying an
       * arbitrary `placement.rect`. How it fills is set by `fullscreenMode`.
       */
      fullscreen?: boolean;
      /**
       * How a `fullscreen` box fills the display:
       *  - 'native' (default when unset): macOS native fullscreen. The window
       *    gets its OWN Space, loses its title bar, and can't be dragged.
       *  - 'maximize': resize the window to fill the display's workArea but keep
       *    the title bar, so it stays a normal, draggable window on the current
       *    desktop (and can still be moved to a `desktopIndex`).
       */
      fullscreenMode?: 'native' | 'maximize';
      /** Ordered, app-specific actions run after this box's window is placed. */
      actions?: BoxAction[];
      groupId?: string;
    }
  | {
      type: 'openUrl';
      id: string;
      url: string;
      browser: 'default' | 'Google Chrome' | 'Safari' | 'Arc';
      newWindow?: boolean;
      groupId?: string;
    }
  | { type: 'openTerminal'; id: string; app: 'Terminal'; cwd: string; command?: string; groupId?: string }
  | { type: 'wait'; id: string; ms: number }
  | { type: 'customAppleScript'; id: string; script: string };

export interface Profile {
  id: string;
  name: string;
  hotkey?: string;
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * How the layout builder presents a display's desktops:
 *  - 'tabs': one canvas per display, active desktop chosen via tab strip (default).
 *  - 'grid': every desktop shown as its own side-by-side frame.
 */
export type DesktopLayoutMode = 'tabs' | 'grid';

/**
 * What a profile run does about desktops (macOS Spaces):
 *  - 'reuse' (default): work on the existing desktop(s) already on screen —
 *    windows are placed on their current/target desktop, none is created.
 *  - 'createNew': at the start of each run, add a fresh desktop via Mission
 *    Control's "+" (SIP-free, on the active display) so the workspace gets a
 *    clean slate. Programmatic per-display placement still needs yabai; without
 *    it you drag the windows onto the new desktop manually.
 */
export type DesktopMode = 'reuse' | 'createNew';

export interface Settings {
  onboardingComplete: boolean;
  schemaVersion: number;
  /** Light / dark / follow-system appearance. */
  theme: ThemeMode;
  /** Accent color as a hex string, e.g. "#0a84ff". */
  accentColor: string;
  /** Tabs (one desktop at a time) vs. grid (all desktops side by side). */
  desktopLayout: DesktopLayoutMode;
  /** Reuse existing desktops vs. create a fresh one on each run. */
  desktopMode: DesktopMode;
}

/** The subset of settings the user can change from the Settings UI. */
export type UserSettings = Pick<Settings, 'theme' | 'accentColor' | 'desktopLayout' | 'desktopMode'>;

export interface StoreSchema {
  profiles: Profile[];
  settings: Settings;
}

export interface LogEntry {
  stepId: string;
  status: 'running' | 'ok' | 'error';
  message: string;
  timestamp: string;
}

export interface RunResult {
  profileId: string;
  ok: boolean;
  log: LogEntry[];
  hasTrackedTargets: boolean;
}

export interface PermissionStatus {
  accessibility: boolean;
  automation: boolean;
}

export interface StopResultEntry {
  label: string;
  closed: boolean;
  method: string;
}

export interface StopResult {
  profileId: string;
  ok: boolean;
  results: StopResultEntry[];
}

export interface DisplayInfo {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

/**
 * A live window captured from the screen (via yabai) that can be turned into a
 * profile box. `rect` is workArea-relative (same NormalizedRect the builder
 * uses); `desktopIndex` is the per-display desktop it currently sits on.
 */
export interface CapturedWindow {
  appName: string;
  /**
   * Bundle identifier (e.g. "com.microsoft.VSCode"), resolved at capture time.
   * yabai's `app` is the *process* name ("Code"), which `open -a` often can't
   * find — the app's real name is different ("Visual Studio Code"). Launching by
   * bundle id (`open -b`) is name-independent, so we prefer it when available.
   */
  bundleId?: string;
  title: string;
  displayId: number; // Electron display id
  rect: NormalizedRect;
  desktopIndex?: number; // per-display desktop (undefined/1 = current)
  fullscreen: boolean;
}
