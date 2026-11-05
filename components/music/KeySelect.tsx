const roots = [
  ["C", "Dó"], ["C#", "Dó sustenido"], ["Db", "Ré bemol"], ["D", "Ré"],
  ["D#", "Ré sustenido"], ["Eb", "Mi bemol"], ["E", "Mi"], ["F", "Fá"],
  ["F#", "Fá sustenido"], ["Gb", "Sol bemol"], ["G", "Sol"], ["G#", "Sol sustenido"],
  ["Ab", "Lá bemol"], ["A", "Lá"], ["A#", "Lá sustenido"], ["Bb", "Si bemol"], ["B", "Si"],
] as const;
const modes = [["", "maior"], ["m", "menor"]] as const;

export function KeySelect({ value, onChange, className, placeholder, originalKey }: {
  value: string; onChange: (key: string) => void; className: string; placeholder: string; originalKey?: string;
}) {
  const options = modes
    .filter(([suffix]) => !originalKey || /(?:m|min)$/.test(originalKey) === Boolean(suffix))
    .flatMap(([suffix, mode]) => roots.map(([root, name]) => ({
      key: root + suffix, label: name + " " + mode + " (" + root + suffix + ")",
    })));
  return <select className={className} value={value} onChange={(event) => onChange(event.target.value)} disabled={originalKey === ""}>
    <option value="">{originalKey === "" ? "Informe o tom da cifra primeiro" : placeholder}</option>
    {value && !options.some((option) => option.key === value) && <option value={value}>{value}</option>}
    {options.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
  </select>;
}
