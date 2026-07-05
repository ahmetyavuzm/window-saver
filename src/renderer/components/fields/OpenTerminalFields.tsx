export interface OpenTerminalValue {
  cwd: string;
  command: string;
}

interface Props {
  value: OpenTerminalValue;
  onChange: (value: OpenTerminalValue) => void;
}

export function OpenTerminalFields({ value, onChange }: Props) {
  return (
    <>
      <input
        placeholder="Working directory"
        value={value.cwd}
        onChange={(e) => onChange({ ...value, cwd: e.target.value })}
        required
      />
      <input
        placeholder="Command (optional, e.g. claude)"
        value={value.command}
        onChange={(e) => onChange({ ...value, command: e.target.value })}
      />
    </>
  );
}
