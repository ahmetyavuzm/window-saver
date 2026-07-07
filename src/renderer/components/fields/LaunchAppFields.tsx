import { useState } from 'react';

export interface LaunchAppValue {
  appName: string;
  autoInsertWait: boolean;
  openNewWindow: boolean;
}

interface Props {
  value: LaunchAppValue;
  onChange: (value: LaunchAppValue) => void;
  // Installed apps for pick-instead-of-type. Empty/undefined falls back to a
  // plain text field. Custom scrollable list — the native <datalist> popup
  // doesn't reliably scroll past its visible rows in Chromium.
  installedApps?: string[];
}

export function LaunchAppFields({ value, onChange, installedApps }: Props) {
  const [open, setOpen] = useState(false);
  const hasApps = !!installedApps && installedApps.length > 0;
  const filtered = hasApps
    ? installedApps!.filter((name) => name.toLowerCase().includes(value.appName.toLowerCase()))
    : [];

  return (
    <>
      <div className="app-picker">
        <input
          placeholder="App name (e.g. Slack)"
          value={value.appName}
          onChange={(e) => {
            onChange({ ...value, appName: e.target.value });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          required
        />
        {open && filtered.length > 0 && (
          <ul className="app-picker-list">
            {filtered.map((name) => (
              <li
                key={name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange({ ...value, appName: name });
                  setOpen(false);
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.autoInsertWait}
          onChange={(e) => onChange({ ...value, autoInsertWait: e.target.checked })}
        />
        Wait for window afterward
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.openNewWindow}
          onChange={(e) => onChange({ ...value, openNewWindow: e.target.checked })}
        />
        Launch new window if already open
      </label>
    </>
  );
}
