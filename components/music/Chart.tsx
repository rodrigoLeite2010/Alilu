import { useMemo } from "react";
import { chartLines, transposeToKey } from "@/lib/music/chart";
import type { SongData } from "@/lib/music/types";

export function Chart({ song, target, font = 20, chords = true }: {
  song: SongData; target?: string; font?: number; chords?: boolean;
}) {
  const lines = useMemo(() => chartLines(song.chart), [song.chart]);
  const key = target || song.key || song.originalKey;
  return <div className="font-mono leading-snug [overflow-wrap:anywhere]" style={{ fontSize: font }}>
    {lines.map(({ heading, parts }, index) => heading
      ? <h3 key={index} className="mt-5 mb-1 font-bold text-current opacity-80">{heading}</h3>
      : <div key={index} className="min-h-[1.1em] whitespace-pre-wrap">
        {parts.map((part, column) => chords && part.chord
          ? <span key={column} className="inline-grid max-w-full align-bottom">
            <strong style={{ color: "var(--music-chord, #0f766e)" }}>
              {part.chord.startsWith("*") ? part.chord.slice(1) : transposeToKey(part.chord, song.originalKey, key)}
            </strong>
            <span>{part.text}</span>
          </span>
          : <span key={column}>{part.text}</span>)}
      </div>)}
  </div>;
}
