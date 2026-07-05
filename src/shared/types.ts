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

export type Step =
  | { type: 'launchApp'; id: string; appName: string; bundleId?: string; args?: string[]; groupId?: string }
  | { type: 'waitForWindow'; id: string; appName: string; timeoutMs?: number; groupId?: string }
  | {
      type: 'positionWindow';
      id: string;
      appName: string;
      rectangleAction?: string;
      placement?: WindowPlacement;
      windowTitle?: string;
      spaceIndex?: number;
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

export interface StoreSchema {
  profiles: Profile[];
  settings: {
    onboardingComplete: boolean;
    schemaVersion: number;
  };
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
