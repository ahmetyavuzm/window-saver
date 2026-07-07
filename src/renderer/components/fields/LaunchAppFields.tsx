export interface LaunchAppValue {
  appName: string;
  autoInsertWait: boolean;
  openNewWindow: boolean;
}

interface Props {
  value: LaunchAppValue;
  onChange: (value: LaunchAppValue) => void;
  // Installed apps for pick-instead-of-type (native datalist autocomplete).
  // Empty/undefined falls back to a plain text field.
  installedApps?: string[];
}

export function LaunchAppFields({ value, onChange, installedApps }: Props) {
  const listId = 'installed-apps-list';
  return (
    <>
      <input
        placeholder="App name (e.g. Slack)"
        value={value.appName}
        onChange={(e) => onChange({ ...value, appName: e.target.value })}
        list={installedApps && installedApps.length > 0 ? listId : undefined}
        required
      />
      {installedApps && installedApps.length > 0 && (
        <datalist id={listId}>
          {installedApps.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
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
