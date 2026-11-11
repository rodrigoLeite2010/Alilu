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

export function transposeToKey(value: string, from: string, to: string) {
  const source = chordMatch(from);
  const target = chordMatch(to);
  const match = chordMatch(value);
  if (!source || !target || !match || source[1] + source[2] === target[1] + target[2]) return value;

  const letters = "CDEFGAB";
  const letterOffset = letters.indexOf(target[1]) - letters.indexOf(source[1]);
  const offset = keyOffset(from, to);
  const useFlats = /[b♭]/.test(target[2]);
  function note(root: string, accidental: string) {
    const letter = letters[(letters.indexOf(root) + letterOffset + 7) % 7];
    const nextPitch = pitch(root, accidental) + offset;
    const alteration = ((nextPitch - roots[letter] + 42) % 12) - 6;
    if (Math.abs(alteration) > 2) return transpose(root + accidental, offset, useFlats);
    return letter + (alteration < 0 ? "b" : "#").repeat(Math.abs(alteration));
  }
  const [, root, accidental, suffix, bass, bassAccidental] = match;
  return note(root, accidental) + suffix + (bass ? "/" + note(bass, bassAccidental) : "");
}

function chordTokens(line: string) {
  const tokens = [...line.matchAll(/[^\s|]+/g)];
  return tokens.length && tokens.every((token) => chordMatch(token[0])) ? tokens : [];
}

function unbold(line: string) {
  return line.replace(/\*\*([^*]+)\*\*/g, "$1");
}

function copiedChartHeader(lines: string[]) {
  const heading = /^(composição de|tom|afinação|capotraste)\s*:\s*(.+)$/i;
  const [title, artist, firstDetail] = lines.filter((line) => line.trim()).slice(0, 3);
  if (!title || !artist || !firstDetail || !heading.test(unbold(firstDetail.trim())) ||
      /^[\[{]|:/.test(title.trim())) return;

  const link = unbold(artist.trim()).match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
  const name = link?.[1] ?? unbold(artist.trim());
  if (!name || /^[\[{]|:/.test(name) || title.trim().length > 160 || name.length > 160) return;

  const metadata: Record<string, string> = { title: unbold(title.trim()), artist: name };
  if (link && link[2].length <= 2000) {
    const url = URL.canParse(link[2]) ? new URL(link[2]) : null;
    if (url && !url.username && !url.password) {
      metadata.url = link[2];
      if (/^(?:www\.)?cifraclub\.com\.br$/i.test(url.hostname)) metadata.source = "Cifra Club";
    }
  }
  const notes: string[] = [];
  let index = lines.indexOf(firstDetail);
  for (; index < lines.length; index++) {
    const line = unbold(lines[index].trim());
    if (!line) continue;
    const detail = line.match(heading);
    if (!detail) break;
    const [, label, value] = detail;
    switch (label.toLowerCase()) {
      case "tom": {
        const key = value.match(/^([A-G][#b♯♭]{0,2}(?:m|maj|min)?)(?:\s*\(com forma de\s+([A-G][#b♯♭]{0,2}(?:m|maj|min)?)\))?$/);
        if (key) {
          metadata.originalKey = key[2] ?? key[1];
          if (key[2]) {
            metadata.key = key[2];
            notes.push("Tom que soa com capotraste: " + key[1]);
          }
        } else notes.push(line);
        break;
      }
      case "capotraste": {
        const fret = value.match(/^(\d{1,2})(?:\s*[ªº]?\s*casa)?$/i);
        if (fret && Number(fret[1]) <= 24) metadata.capo = fret[1];
        else notes.push(line);
        break;
      }
      default: notes.push(line);
    }
  }
  if (notes.length) metadata.notes = notes.join("\n").slice(0, 3000);
  return { metadata, index };
}

export function importChart(raw: string, chordPro = false) {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.replace(/\t/g, "    ").replace(/\u00a0/g, " "));
  const header = chordPro ? undefined : copiedChartHeader(lines);
  const metadata: Record<string, string> = header?.metadata ?? {};
  const result: string[] = [];
  let review = false;
  for (let index = header?.index ?? 0; index < lines.length; index++) {
    let line = lines[index];
    if (header) {
      line = unbold(line);
      const part = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
      if (part && !chordMatch(part[1]) && !part[1].startsWith("*") && (!part[2] || chordTokens(part[2]).length)) {
        result.push("{comment: " + part[1] + "}");
        if (part[2]) result.push(part[2].replace(/[^\s|]+/g, (token) => "[" + token + "]"));
        continue;
      }
      const progression = line.trim().match(/^\(\s*(.*?)\s*\)$/);
      if (progression && chordTokens(progression[1]).length) {
        result.push("(" + progression[1].replace(/[^\s|]+/g, (token) => "[" + token + "]") + ")");
        continue;
      }
    }
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
    let nextIndex = index + 1;
    while (header && nextIndex < lines.length && !lines[nextIndex].trim()) nextIndex++;
    const next = header && lines[nextIndex] ? unbold(lines[nextIndex]) : lines[nextIndex];
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
      index = nextIndex;
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

function plainChordParts(line: string) {
  // Older imports can contain an unmarked chord row with a trailing cue.
  const row = line.replace(/\s+\([^)]*\)\s*$/, "");
  const tokens = [...row.matchAll(/[^\s|]+/g)];
  if (!tokens.length || !tokens.every((token) => chordMatch(unbold(token[0])))) return [];

  let position = 0;
  const parts = tokens.map((token) => {
    const text = line.slice(position, token.index);
    position = token.index + token[0].length;
    return { text, chord: unbold(token[0]) };
  });
  parts.push({ text: line.slice(position), chord: "" });
  return parts;
}

type ChartPart = { chord: string; text: string };
type ChartLine = { heading: string; parts: ChartPart[]; plainChords?: ChartPart[] };

export function chartLines(chart: string) {
  return chart.split("\n").flatMap<ChartLine>((line) => {
    if (line.trimStart().startsWith("#")) return [];
    const info = line.trim().match(directive);
    if (info) {
      const heading = ["comment", "c", "ci", "cb", "comment_italic", "comment_box"].includes(info[1])
        ? info[2] : sections[info[1]] ? info[2] || sections[info[1]] : "";
      return heading ? [{ heading, parts: [] }] : [];
    }
    const parts: ChartPart[] = [];
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
    return [{ heading: "", parts, plainChords: position === 0 ? plainChordParts(line) : [] }];
  });
}
