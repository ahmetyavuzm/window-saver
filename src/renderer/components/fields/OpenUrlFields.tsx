export type Browser = 'default' | 'Google Chrome' | 'Safari' | 'Arc';

export interface OpenUrlValue {
  url: string;
  browser: Browser;
  newWindow: boolean;
}

interface Props {
  value: OpenUrlValue;
  onChange: (value: OpenUrlValue) => void;
  allowDefaultBrowser?: boolean;
}

export function OpenUrlFields({ value, onChange, allowDefaultBrowser = true }: Props) {
  // "Default browser" can't be targeted by AppleScript, so new-window control
  // only applies to a named browser.
  const canChooseWindow = value.browser !== 'default';
  return (
    <>
      <input
        placeholder="https://…"
        value={value.url}
        onChange={(e) => onChange({ ...value, url: e.target.value })}
        required
      />
      <select value={value.browser} onChange={(e) => onChange({ ...value, browser: e.target.value as Browser })}>
        {allowDefaultBrowser && <option value="default">Default browser</option>}
        <option value="Google Chrome">Google Chrome</option>
        <option value="Safari">Safari</option>
        <option value="Arc">Arc</option>
      </select>
      {canChooseWindow && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.newWindow}
            onChange={(e) => onChange({ ...value, newWindow: e.target.checked })}
          />
          Open in a new window (instead of a tab)
        </label>
      )}
    </>
  );
}
