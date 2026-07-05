export type Step =
  | { type: 'launchApp'; id: string; appName: string; bundleId?: string; args?: string[] }
  | { type: 'waitForWindow'; id: string; appName: string; timeoutMs?: number }
  | {
      type: 'positionWindow';
      id: string;
      appName: string;
      rectangleAction: string;
      windowTitle?: string;
      spaceIndex?: number;
    }
  | {
      type: 'openUrl';
      id: string;
      url: string;
      browser: 'default' | 'Google Chrome' | 'Safari' | 'Arc';
      newWindow?: boolean;
    }
  | { type: 'openTerminal'; id: string; app: 'Terminal'; cwd: string; command?: string }
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
