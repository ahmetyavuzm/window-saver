export type Browser = 'default' | 'Google Chrome' | 'Safari' | 'Arc';

export interface OpenUrlValue {
  url: string;
  browser: Browser;
}

interface Props {
  value: OpenUrlValue;
  onChange: (value: OpenUrlValue) => void;
  allowDefaultBrowser?: boolean;
}

export function OpenUrlFields({ value, onChange, allowDefaultBrowser = true }: Props) {
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
    </>
  );
}
