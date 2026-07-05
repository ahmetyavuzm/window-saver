export interface LaunchAppValue {
  appName: string;
  autoInsertWait: boolean;
}

interface Props {
  value: LaunchAppValue;
  onChange: (value: LaunchAppValue) => void;
}

export function LaunchAppFields({ value, onChange }: Props) {
  return (
    <>
      <input
        placeholder="App name (e.g. Slack)"
        value={value.appName}
        onChange={(e) => onChange({ ...value, appName: e.target.value })}
        required
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.autoInsertWait}
          onChange={(e) => onChange({ ...value, autoInsertWait: e.target.checked })}
        />
        Wait for window afterward
      </label>
    </>
  );
}
