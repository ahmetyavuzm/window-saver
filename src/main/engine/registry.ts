// In-memory only (no persistence across app restart) — tracking a launched
// app/tab/window only makes sense for the lifetime of this process; after a
// restart there is nothing reliable to reconnect to.
export type TrackedTarget =
  | { kind: 'process'; label: string; pid: number }
  | { kind: 'browserTab'; label: string; browser: string; windowId: number; tabIndex?: number }
  | { kind: 'terminalWindow'; label: string; windowId: number };

const registry = new Map<string, TrackedTarget[]>();

export function track(profileId: string, target: TrackedTarget): void {
  const list = registry.get(profileId) ?? [];
  list.push(target);
  registry.set(profileId, list);
}

export function getTracked(profileId: string): TrackedTarget[] {
  return registry.get(profileId) ?? [];
}

export function hasTracked(profileId: string): boolean {
  return (registry.get(profileId)?.length ?? 0) > 0;
}

export function clear(profileId: string): void {
  registry.delete(profileId);
}
