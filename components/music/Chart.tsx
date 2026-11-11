import { useMemo } from "react";
import { chartLines, transposeToKey } from "@/lib/music/chart";
import type { SongData } from "@/lib/music/types";

export function Chart({ song, source = song.originalKey, target, font = 20, chords = true }: {
  song: SongData; source?: string; target?: string; font?: number; chords?: boolean;
}) {
  const lines = useMemo(() => chartLines(song.chart), [song.chart]);
  const key = target || song.key || source;
  const transposeChord = (chord: string) =>
    chord.startsWith("*") ? chord.slice(1) : transposeToKey(chord, source, key);
  return <div className="font-mono leading-snug [overflow-wrap:anywhere]" style={{ fontSize: font }}>
    {lines.map((line, index) => {
      const { heading, parts } = line;
      if (heading) return <h3 key={index} className="mt-5 mb-1 font-bold text-current opacity-80">{heading}</h3>;
      if (line.plainChords?.length) {
        return <div key={index} className="min-h-[1.1em] whitespace-pre-wrap">
          {line.plainChords.map((part, column) => <span key={column}>
            {part.text}
            {chords && part.chord && <strong style={{ color: "var(--music-chord, #0f766e)" }}>{transposeChord(part.chord)}</strong>}
          </span>)}
        </div>;
      }
      return <div key={index} className="min-h-[1.1em] whitespace-pre-wrap">
        {parts.map((part, column) => chords && part.chord
          ? <span key={column} className="inline-grid max-w-full align-bottom">
            <strong style={{ color: "var(--music-chord, #0f766e)" }}>
              {transposeChord(part.chord)}
            </strong>
            <span>{part.text}</span>
          </span>
          : <span key={column}>{part.text}</span>)}
      </div>;
    })}
  </div>;
}
