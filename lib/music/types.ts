export type SongData = {
  title: string; artist: string; originalKey: string; key: string; capo: string;
  rhythm: string; bpm: string; genre: string; chart: string; notes: string;
  source: string; url: string; speed: number;
};
export type Song = SongData & { id: string; revision: number };
export type SongSummary = Omit<Song, "chart" | "notes" | "url" | "source">;
export type SetItem = { id: string; songId: string; key: string; notes: string; speed: number };
export type SetData = {
  name: string; description: string; date: string; minutes: string; notes: string;
  items: SetItem[]; finish: "manual" | "advance" | "play" | "delay";
  delay: number; sync: "song" | "scroll";
};
export type MusicSet = SetData & { id: string; revision: number; playedAt: string | null };
export type Program = Omit<SetData, "items"> & { tracks: { item: SetItem; song: Song }[] };
export type Playback = { index: number; position: number; speed: number; extent: number; playing: boolean };
export type Live = {
  id: string; version: number; updatedAt: string; serverTime: string; ended: boolean;
  leader: boolean; owner: boolean; participant: string; state: Playback; code?: string; program?: Program;
  devices?: { participant: string; joinedAt: string }[];
};

export const emptySong: SongData = {
  title: "", artist: "", originalKey: "", key: "", capo: "", rhythm: "", bpm: "",
  genre: "", chart: "", notes: "", source: "", url: "", speed: 35,
};
export const emptySet: SetData = {
  name: "", description: "", date: "", minutes: "", notes: "", items: [],
  finish: "manual", delay: 5, sync: "scroll",
};
export const musicTabs = [
  ["musicas", "Minhas Músicas"],
  ["repertorios", "Repertórios"],
  ["ao-vivo", "Apresentações ao Vivo"],
] as const;

export function trackSpeed(track: Program["tracks"][number]) {
  return track.item.speed || track.song.speed;
}
