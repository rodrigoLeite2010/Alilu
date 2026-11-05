import { emptySet, emptySong } from "./types";

export class MusicError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function requireValue(condition: unknown, message = "Dados inválidos.", status = 400): asserts condition {
  if (!condition) throw new MusicError(message, status);
}

export function record(value: unknown): Record<string, unknown> {
  requireValue(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function string(value: unknown, limit = 160) {
  requireValue(typeof value === "string" && value.length <= limit && !value.includes("\0"), "Revise o tamanho dos campos.");
  return value.trim();
}

export function number(value: unknown, min: number, max: number) {
  requireValue(typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
  return value;
}

function numericField(value: unknown, min: number, max: number) {
  const field = string(value, 6);
  if (field) requireValue(/^\d+$/.test(field) && Number(field) >= min && Number(field) <= max, "Revise os campos numéricos.");
  return field;
}

export function uuid(value: unknown) {
  requireValue(typeof value === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value));
  return value.toLowerCase();
}

function key(value: unknown) {
  const result = string(value, 8);
  requireValue(!result || /^[A-G][#b♯♭]{0,2}(?:m|maj|min)?$/.test(result), "Use um tom como C, Bb ou F#m.");
  return result;
}

export function songInput(value: unknown) {
  const input = { ...emptySong, ...record(value) };
  const title = string(input.title);
  const chart = string(input.chart, 50_000);
  requireValue(title && chart, "Preencha o título e a letra ou cifra.");
  const url = string(input.url, 2000);
  if (url) {
    const parsed = URL.canParse(url) ? new URL(url) : null;
    requireValue(parsed && ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password, "Informe um link HTTP ou HTTPS válido.");
  }
  return {
    title, chart, url, artist: string(input.artist), originalKey: key(input.originalKey), key: key(input.key),
    capo: numericField(input.capo, 0, 24), rhythm: string(input.rhythm), bpm: numericField(input.bpm, 1, 400),
    genre: string(input.genre), notes: string(input.notes, 3000), source: string(input.source),
    speed: number(input.speed, 5, 150),
  };
}

export function setInput(value: unknown) {
  const input = { ...emptySet, ...record(value) };
  const name = string(input.name);
  requireValue(name, "Dê um nome ao repertório.");
  requireValue(Array.isArray(input.items) && input.items.length <= 100, "Use até 100 músicas por repertório.");
  const items = input.items.map((value) => {
    const item = record(value);
    return { id: uuid(item.id), songId: uuid(item.songId), key: key(item.key), notes: string(item.notes, 250), speed: number(item.speed, 0, 150) };
  });
  requireValue(new Set(items.map((item) => item.id)).size === items.length);
  const date = string(input.date, 10);
  requireValue(!date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().startsWith(date)));
  requireValue(input.finish === "manual" || input.finish === "advance" || input.finish === "play" || input.finish === "delay");
  requireValue(input.sync === "song" || input.sync === "scroll");
  return { name, items, date, description: string(input.description, 1500), notes: string(input.notes, 3000),
    minutes: numericField(input.minutes, 1, 1440), finish: input.finish, sync: input.sync, delay: number(input.delay, 1, 60) };
}

export function playbackInput(value: unknown) {
  const input = record(value);
  const index = number(input.index, 0, 99);
  requireValue(Number.isInteger(index) && typeof input.playing === "boolean");
  return { index, extent: number(input.extent, 0, 10_000_000), playing: input.playing, speed: number(input.speed, 5, 150), position: number(input.position, 0, 1) };
}
