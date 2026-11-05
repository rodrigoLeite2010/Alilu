"use client";

import { useEffect, useRef, useState } from "react";
import { importChart } from "@/lib/music/chart";
import { downloadChart, musicApi } from "@/lib/music/client";
import { emptySong, type Song, type SongData } from "@/lib/music/types";
import { Chart } from "./Chart";

export const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-current/20 px-3 py-2 text-sm font-semibold hover:bg-current/5 disabled:opacity-40";
export const primary = button + " bg-brand-primary text-white hover:bg-brand-primary-dark";
export const field = "min-h-11 min-w-0 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-950";
export const panel = "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6";

export function useDraft<T extends { id: string; revision: number }>(initial: T, action: string, ready: (draft: T) => boolean, autoSave = true) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const current = useRef(initial);
  const confirmed = useRef(initial);
  const saving = useRef(false);
  const saveRef = useRef<() => void>(() => {});
  function change(next: T) {
    current.current = next;
    setDraft(next);
    setDirty(true);
    setStatus("Alterações pendentes");
  }
  async function save() {
    const snapshot = current.current;
    if (saving.current || snapshot === confirmed.current || !ready(snapshot)) return;
    saving.current = true;
    setBusy(true);
    try {
      const saved = await musicApi<T>({ action, id: snapshot.id, revision: confirmed.current.revision, data: snapshot });
      // The server normalizes fields. Preserve edits typed while this save was pending.
      if (current.current === snapshot) {
        confirmed.current = saved;
        current.current = saved;
        setDraft(saved);
        setDirty(false);
        setStatus("Salvo");
      } else {
        confirmed.current = saved;
        setStatus("Alterações pendentes");
        setTimeout(() => saveRef.current(), 0);
      }
      return true;
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    saveRef.current = () => { if (autoSave) void save(); };
    return () => { saveRef.current = () => {}; };
  });
  useEffect(() => {
    if (!dirty) return;
    const timer = autoSave ? setTimeout(() => saveRef.current(), 950) : undefined;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", guard);
    };
  }, [autoSave, draft, dirty]);
  return { draft, change, save, status, busy, dirty, savedRevision: draft.revision };
}

export function exportSong(song: SongData) {
  const line = (name: string, value: string) => value ? "{" + name + ": " + value.replace(/[\r\n{}]/g, " ") + "}\n" : "";
  return line("title", song.title) + line("artist", song.artist) +
    line("key", song.originalKey) + line("capo", song.capo) + line("tempo", song.bpm) + song.chart;
}

const fields: { name: Exclude<keyof SongData, "chart" | "notes" | "speed">; label: string }[] = [
  { name: "title", label: "Título" }, { name: "artist", label: "Artista ou compositor" },
  { name: "originalKey", label: "Tom em que a cifra foi escrita" }, { name: "key", label: "Tom utilizado" },
  { name: "capo", label: "Capotraste" }, { name: "rhythm", label: "Ritmo ou andamento" },
  { name: "bpm", label: "BPM" }, { name: "genre", label: "Estilo" },
  { name: "source", label: "Fonte" }, { name: "url", label: "Link de referência" },
];

export function SongEditor({ initial, close }: { initial: Song; close: (saved: boolean) => void }) {
  const [reviewImport, setReviewImport] = useState(false);
  const { draft, change, save, dirty, status, busy, savedRevision } = useDraft(initial, "song-save",
    (song) => Boolean(song.title.trim() && song.chart.trim()), !reviewImport);
  const [font, setFont] = useState(19);
  const [importing, setImporting] = useState(false);
  const [raw, setRaw] = useState("");
  const [imports, setImports] = useState<ReturnType<typeof importChart>[]>([]);
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [chord, setChord] = useState("");
  const patch = (data: Partial<SongData>) => change({ ...draft, ...data });

  function applyImport(result: ReturnType<typeof importChart>) {
    setReviewImport(true);
    patch({ ...result.metadata, chart: result.chart });
    setNotice(result.review ? "A conversão encontrou trechos ambíguos. Confira os acordes na prévia." : "Confira a letra e os acordes na prévia.");
    setImporting(false);
    setRaw("");
    setImports((queue) => queue.filter((candidate) => candidate !== result));
  }

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setNotice("");
    try {
      const queue = [];
      if (files.length > 15) throw new Error("Selecione até 15 arquivos por lote.");
      for (const file of Array.from(files)) {
        const pdf = /\.pdf$/i.test(file.name);
        const chordPro = /\.(cho|chopro|chordpro|crd|pro)$/i.test(file.name);
        if (!(pdf || /\.(txt|cho|chopro|chordpro|crd|pro)$/i.test(file.name)) || file.size > (pdf ? 5_000_000 : 200_000)) {
          throw new Error("Use TXT/ChordPro de até 200 KB ou PDF textual de até 5 MB.");
        }
        const text = pdf
          ? (await (await import("@/lib/pdf/pdf-text")).extractPdfTextPages(file))
            .map((page) => page.rows.map((row) => row.text).join("\n")).join("\n\n")
          : await file.text();
        if (!text.trim() || text.length > 50_000 || text.includes("\0")) throw new Error("O arquivo está vazio ou contém texto inválido ou extenso demais.");
        const tracks = chordPro ? text.split(/^\s*\{(?:new_song|ns)\s*\}\s*$/im).filter((part) => part.trim()) : [text];
        if (queue.length + tracks.length > 30) throw new Error("Importe até 30 músicas por lote.");
        for (const [index, track] of tracks.entries()) {
          const result = importChart(track, chordPro);
          const name = file.name.replace(/\.[^.]+$/, "") + (tracks.length > 1 ? " " + (index + 1) : "");
          queue.push({ ...result, metadata: { title: name.slice(0, 160), ...result.metadata }, review: result.review || pdf });
        }
      }
      setImports(queue);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function saveBatch() {
    setReading(true);
    setNotice("");
    try {
      for (const result of imports) {
        await musicApi({ action: "song-save", id: crypto.randomUUID(), revision: 0,
          data: { ...emptySong, ...result.metadata, chart: result.chart } });
        setImports((queue) => queue.filter((candidate) => candidate !== result));
      }
      setNotice("Arquivos salvos na biblioteca.");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setReading(false);
    }
  }

  function insert(value: string) {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart;
    patch({ chart: draft.chart.slice(0, start) + value + draft.chart.slice(element.selectionEnd) });
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + value.length, start + value.length);
    });
  }

  return <section className={panel}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-bold">{initial.revision ? "Editar música" : "Adicionar música"}</h2>
      <button className={button} onClick={() => close(!dirty || window.confirm("Sair e descartar alterações pendentes?"))}>Voltar à biblioteca</button>
    </div>
    <div className="flex flex-wrap gap-2">
      <button className={button} onClick={() => setImporting(!importing)}>Importar música</button>
      <button className={button} disabled={!draft.chart} onClick={() => downloadChart(draft.title || "música", exportSong(draft))}>Exportar ChordPro</button>
    </div>
    {importing && <div className="my-4 space-y-3 rounded-lg bg-zinc-50 p-3">
      <label className="block">Cole letra e cifra ou um texto ChordPro<textarea className={field + " font-mono"} rows={5} value={raw} onChange={(event) => setRaw(event.target.value)} maxLength={50000} /></label>
      <button className={button} disabled={!raw.trim()} onClick={() => applyImport(importChart(raw))}>Converter e revisar</button>
      <label className="block">Arquivos próprios ou autorizados (TXT, ChordPro e PDF textual)
        <input className={field} type="file" multiple accept=".txt,.cho,.chopro,.chordpro,.crd,.pro,.pdf" disabled={reading} onChange={(event) => void readFiles(event.target.files)} />
      </label>
      {!!imports.length && <div className="space-y-2">
        {imports.map((result, index) => <details key={index}>
          <summary>{result.metadata.title} {result.review && "· conferir alinhamento"}</summary>
          <Chart song={{ ...emptySong, ...result.metadata, chart: result.chart }} font={16} />
          <button className={button} disabled={reading} onClick={() => applyImport(result)}>Editar esta música</button>
        </details>)}
        <button className={primary} disabled={reading} onClick={() => void saveBatch()}>Salvar arquivos revisados na biblioteca</button>
      </div>}
      <p className="text-sm text-zinc-600">Para páginas externas, registre a origem e o link de referência abaixo. Use conteúdo próprio ou autorizado.</p>
    </div>}
    {notice && <p role="status" className="my-3 text-sm text-teal-800">{notice}</p>}
    <div className="my-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map(({ name, label }) => <label key={name} className="text-sm font-medium">{label}
        <input className={field} value={draft[name]} maxLength={name === "url" ? 2000 : 160} onChange={(event) => patch({ [name]: event.target.value })} />
      </label>)}
    </div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input aria-label="Acorde a inserir" placeholder="Ex. G/B" className={field + " max-w-28"} value={chord} maxLength={32} onChange={(event) => setChord(event.target.value)} />
          <button className={button} disabled={!chord.trim()} onClick={() => insert("[" + chord.trim() + "]")}>Inserir acorde</button>
          <select aria-label="Inserir seção" className={field + " max-w-36"} value="" onChange={(event) => insert("\n{comment: " + event.target.value + "}\n")}>
            <option value="" disabled>Inserir seção</option>
            {["Introdução", "Verso", "Refrão", "Ponte", "Final"].map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>
        <label className="block text-sm font-medium">Letra e cifra em ChordPro
          <textarea ref={textarea} className={field + " font-mono"} rows={14} spellCheck={false} maxLength={50000} value={draft.chart} onChange={(event) => patch({ chart: event.target.value })} />
        </label>
        <p className="text-sm text-zinc-500">Posicione o cursor antes da palavra e insira o acorde. Exemplo <code>[Am]Minha letra</code>.</p>
      </div>
      <div className="min-w-0 space-y-3 rounded-lg border border-zinc-200 p-3">
        <label className="flex flex-wrap items-center gap-3 text-sm font-medium">Prévia · tamanho da fonte
          <input type="range" min={14} max={36} value={font} onChange={(event) => setFont(+event.target.value)} />
        </label>
        <Chart song={draft} font={font} />
      </div>
    </div>
    <div className="my-4 grid gap-3 sm:grid-cols-2">
      <label>Observações<textarea className={field} maxLength={3000} value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} /></label>
      <label>Velocidade preferida ({draft.speed})<input className="block w-full" type="range" min={5} max={150} value={draft.speed} onChange={(event) => patch({ speed: +event.target.value })} /></label>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button className={primary} onClick={() => void save().then((saved) => { if (saved) setReviewImport(false); })}
        disabled={busy || !draft.title.trim() || !draft.chart.trim()}>Salvar música</button>
      <span role="status" className="text-sm">{busy ? "Salvando…" : status || (savedRevision ? "Música salva" : "Preencha título e letra para salvar.")}</span>
    </div>
  </section>;
}
