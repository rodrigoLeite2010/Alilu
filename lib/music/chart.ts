const sharp = "C C# D D# E F F# G G# A A# B".split(" ");
const flat = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
const roots: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const chord = /^([A-G])([#b♯♭]{0,2})((?:(?:maj|min|dim|aug|sus|add|omit|alt|no|m|M|ø|°|Δ|[0-9+#b♯♭()−-]|\/(?![A-G])))*)(?:\/([A-G])([#b♯♭]{0,2}))?$/;
const section = /^\[?\s*(intro(?:dução)?|verso|verse|refrão|chorus|ponte|bridge|final|outro|solo)(?:\s+(\d+))?\s*[\]:]?$/i;
const directive = /^\{\s*([\w-]+)\s*(?::\s*(.*?))?\s*\}$/;

function chordMatch(value: string) {
  return value.length <= 64 ? value.match(chord) : null;
}

function pitch(note: string, accidental: string) {
  return roots[note] + [...accidental].reduce((sum, sign) => sum + ("#♯".includes(sign) ? 1 : -1), 0);
}

export function keyOffset(from: string, to: string) {
  const source = chordMatch(from);
  const target = chordMatch(to);
  return source && target ? pitch(target[1], target[2]) - pitch(source[1], source[2]) : 0;
}

export function transpose(value: string, offset: number, useFlats = false) {
  const match = chordMatch(value);
  if (!match || !offset) return value;
  const [, root, accidental, suffix, bass, bassAccidental] = match;
  const notes = useFlats ? flat : sharp;
  const note = (name: string, sign: string) => notes[((pitch(name, sign) + offset) % 12 + 12) % 12];
  return note(root, accidental) + suffix + (bass ? "/" + note(bass, bassAccidental) : "");
}

function chordTokens(line: string) {
  const tokens = [...line.matchAll(/[^\s|]+/g)];
  return tokens.length && tokens.every((token) => chordMatch(token[0])) ? tokens : [];
}

export function importChart(raw: string, chordPro = false) {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.replace(/\t/g, "    "));
  const metadata: Record<string, string> = {};
  const result: string[] = [];
  let review = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const info = line.trim().match(directive);
    const plain = line.match(/^\s*(título|title|artista|artist|tom|key):\s*(.+)$/i);
    const label = (info?.[1] || plain?.[1] || "").toLowerCase();
    const field = ({
      t: "title", title: "title", título: "title", artist: "artist", artista: "artist",
      subtitle: "artist", st: "artist", key: "originalKey", tom: "originalKey",
      capo: "capo", tempo: "bpm",
    } as Record<string, string>)[label];
    if (field && (info?.[2] || plain?.[2])) {
      metadata[field] ||= (info?.[2] || plain?.[2] || "").trim();
      continue;
    }
    if (!chordPro && section.test(line.trim())) {
      result.push("{comment: " + line.trim().replace(/^\[|[\]:]$/g, "") + "}");
      continue;
    }
    const tokens = chordPro ? [] : chordTokens(line);
    if (!tokens.length || /\[[^\]]+\]/.test(line)) {
      result.push(line);
      continue;
    }
    const next = lines[index + 1];
    if (tokens.length === 1) review = true;
    if (next?.trim() && !chordTokens(next).length && !section.test(next.trim()) &&
        !next.trim().match(directive) && !next.includes("[")) {
      let column = 0;
      let aligned = "";
      for (const token of tokens) {
        if (token.index > next.length) review = true;
        aligned += next.slice(column, token.index) + "[" + token[0] + "]";
        column = token.index;
      }
      result.push(aligned + next.slice(column));
      index++;
    } else {
      result.push(line.replace(/[^\s|]+/g, (token) => "[" + token + "]"));
    }
  }
  return { chart: result.join("\n").trim(), metadata, review };
}

const sections: Record<string, string> = {
  soc: "Refrão", start_of_chorus: "Refrão", sov: "Verso", start_of_verse: "Verso",
  sob: "Ponte", start_of_bridge: "Ponte", chorus: "Refrão",
};

export function chartLines(chart: string) {
  return chart.split("\n").flatMap((line) => {
    if (line.trimStart().startsWith("#")) return [];
    const info = line.trim().match(directive);
    if (info) {
      const heading = ["comment", "c", "ci", "cb", "comment_italic", "comment_box"].includes(info[1])
        ? info[2] : sections[info[1]] ? info[2] || sections[info[1]] : "";
      return heading ? [{ heading, parts: [] }] : [];
    }
    const parts: { chord: string; text: string }[] = [];
    let position = 0;
    let previousChord = "";
    for (const token of line.matchAll(/\[([^\]\n]+)\]/g)) {
      if (!chordMatch(token[1]) && !token[1].startsWith("*")) continue;
      if (token.index > position || previousChord) {
        parts.push({ chord: previousChord, text: line.slice(position, token.index) });
      }
      previousChord = token[1];
      position = token.index + token[0].length;
    }
    parts.push({ chord: previousChord, text: line.slice(position) });
    return [{ heading: "", parts }];
  });
}
