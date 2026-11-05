"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { downloadChart, musicApi } from "@/lib/music/client";
import { emptySet, emptySong, musicTabs, type MusicSet, type Program, type Song, type SongSummary } from "@/lib/music/types";
import { button, exportSong, field, panel, primary, SongEditor, useDraft } from "./SongEditor";

type Library = { songs: SongSummary[]; sets: MusicSet[]; sessions: { id: string; name: string; ended: boolean }[] };

function SetEditor({ initial, songs, close, createSong }: {
  initial: MusicSet; songs: SongSummary[]; close: () => void; createSong: () => void;
}) {
  const { draft, change, save, dirty, status, busy } = useDraft(initial, "set-save", (set) => Boolean(set.name.trim()));
  const [search, setSearch] = useState("");
  const [dragged, setDragged] = useState("");
  const [error, setError] = useState("");
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const update = (patch: Partial<MusicSet>) => change({ ...draft, ...patch });

  function move(from: number, to: number) {
    if (from < 0 || to < 0 || to >= draft.items.length || from === to) return;
    const items = [...draft.items];
    items.splice(to, 0, ...items.splice(from, 1));
    update({ items });
  }

  async function exportSet() {
    try {
      const program = await musicApi<Program>({ action: "program", id: draft.id });
      downloadChart(draft.name, program.tracks.map(({ song }) => exportSong(song)).join("\n\n{new_song}\n\n"));
    } catch (error) {
      setError((error as Error).message);
    }
  }

  const stage = "/musicas/palco?repertorio=" + draft.id;
  return <section className={panel + " space-y-4"}>
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="text-xl font-bold">Organizar repertório</h2>
      <button className={button} onClick={() => { if (!dirty || window.confirm("Sair e descartar alterações pendentes?")) close(); }}>Voltar aos repertórios</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Nome<input className={field} maxLength={160} value={draft.name} onChange={(event) => update({ name: event.target.value })} /></label>
      <label>Descrição<input className={field} maxLength={1500} value={draft.description} onChange={(event) => update({ description: event.target.value })} /></label>
      <label>Data<input className={field} type="date" value={draft.date} onChange={(event) => update({ date: event.target.value })} /></label>
      <label>Duração estimada (min)<input className={field} type="number" min={1} max={1440} value={draft.minutes} onChange={(event) => update({ minutes: event.target.value })} /></label>
      <label className="sm:col-span-2">Observações<textarea className={field} maxLength={3000} value={draft.notes} onChange={(event) => update({ notes: event.target.value })} /></label>
      <label>Ao terminar a rolagem
        <select className={field} value={draft.finish} onChange={(event) => update({ finish: event.target.value as MusicSet["finish"] })}>
          <option value="manual">Pausar e aguardar comando</option><option value="advance">Avançar e aguardar</option>
          <option value="play">Avançar e iniciar rolagem</option><option value="delay">Avançar após uma pausa</option>
        </select>
      </label>
      {draft.finish === "delay" && <label>Pausa (segundos)<input className={field} type="number" min={1} max={60} value={draft.delay} onChange={(event) => update({ delay: +event.target.value })} /></label>}
      <label>Espelhamento
        <select className={field} value={draft.sync} onChange={(event) => update({ sync: event.target.value as MusicSet["sync"] })}>
          <option value="scroll">Música e posição da rolagem</option><option value="song">Apenas música atual</option>
        </select>
      </label>
    </div>
    <h3 className="text-lg font-bold">Ordem das músicas</h3>
    <ol className="space-y-2">
      {draft.items.map((item, index) => <li key={item.id} className="rounded-lg border border-zinc-200 p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); move(draft.items.findIndex((entry) => entry.id === dragged), index); setDragged(""); }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong draggable onDragStart={(event) => { event.dataTransfer.setData("text/plain", item.id); setDragged(item.id); }} onDragEnd={() => setDragged("")} className="cursor-grab">
            {index + 1}. {songsById.get(item.songId)?.title || "Música excluída"}
          </strong>
          <div className="flex gap-1">
            <button aria-label={"Subir música " + (index + 1)} className={button} disabled={!index} onClick={() => move(index, index - 1)}>↑</button>
            <button aria-label={"Descer música " + (index + 1)} className={button} disabled={index === draft.items.length - 1} onClick={() => move(index, index + 1)}>↓</button>
            <button className={button} onClick={() => update({ items: draft.items.filter((entry) => entry.id !== item.id) })}>Remover</button>
          </div>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-sm">Tom no repertório<input className={field} maxLength={8} placeholder="Tom da música" value={item.key}
            onChange={(event) => update({ items: draft.items.map((entry) => entry.id === item.id ? { ...entry, key: event.target.value } : entry) })} /></label>
          <label className="text-sm">Velocidade (0 usa a da música)<input className={field} type="number" min={0} max={150} value={item.speed}
            onChange={(event) => update({ items: draft.items.map((entry) => entry.id === item.id ? { ...entry, speed: +event.target.value } : entry) })} /></label>
          <label className="text-sm">Observações<input className={field} maxLength={250} value={item.notes}
            onChange={(event) => update({ items: draft.items.map((entry) => entry.id === item.id ? { ...entry, notes: event.target.value } : entry) })} /></label>
        </div>
      </li>)}
    </ol>
    <div className="flex flex-wrap items-end gap-2">
      <label className="grow">Buscar músicas para adicionar<input className={field} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <select aria-label="Adicionar música existente" className={field + " sm:w-auto"} value="" disabled={draft.items.length >= 100} onChange={(event) => {
        update({ items: [...draft.items, { id: crypto.randomUUID(), songId: event.target.value, key: "", speed: 0, notes: "" }] });
      }}>
        <option value="" disabled>Selecione uma música</option>
        {songs.filter((song) => matches(search, song.title, song.artist)).map((song) => <option key={song.id} value={song.id}>{song.title}{song.artist ? " · " + song.artist : ""}</option>)}
      </select>
      <button className={button} onClick={createSong}>Criar música aqui</button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <button className={primary} onClick={() => void save()} disabled={busy || !draft.name.trim()}>Salvar repertório</button>
      {!dirty && draft.revision > 0 && draft.items.length > 0 && <>
        <Link className={button} href={stage}>Modo Ensaio</Link>
        <Link className={button} href={stage + "&revisao=" + draft.revision}>Modo Apresentação</Link>
        <button className={button} onClick={() => void exportSet()}>Exportar ChordPro</button>
      </>}
      <span role="status" className="text-sm">{busy ? "Salvando…" : status}</span>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>;
}

function matches(query: string, ...values: string[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  return normalize(values.join(" ")).includes(normalize(query.trim()));
}

export function MusicLibrary({ tab }: { tab: "musicas" | "repertorios" | "ao-vivo" }) {
  const [library, setLibrary] = useState<Library>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [song, setSong] = useState<Song>();
  const [set, setSet] = useState<MusicSet>();
  const [busy, setBusy] = useState(false);
  const [refresh, reload] = useState(0);


  useEffect(() => {
    const controller = new AbortController();
    musicApi<Library>(undefined, "", controller.signal).then(setLibrary).catch((error) => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, [refresh]);

  function newSong() {
    setSong({ ...emptySong, id: crypto.randomUUID(), revision: 0 });
  }

  async function task(work: () => Promise<unknown>, update = false) {
    setBusy(true);
    setError("");
    try {
      await work();
      if (update) reload((value) => value + 1);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const recent = [...(library?.sets || [])].filter((set) => set.playedAt).sort((a, b) => b.playedAt!.localeCompare(a.playedAt!)).slice(0, 3);
  const stagePath = "/musicas/palco";
  return <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-9">
    <header className="rounded-2xl bg-brand-primary px-5 py-6 text-white sm:px-7">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-100">Alilu · Músicas</p>
      <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Letras, cifras e repertórios</h1>
      <p className="mt-2 max-w-2xl text-teal-50">Prepare as músicas do ensaio e acompanhe a apresentação em vários dispositivos.</p>
    </header>
    <nav aria-label="Músicas" className="flex flex-wrap gap-2">
      {musicTabs.map(([id, name]) =>
        <Link key={id} className={tab === id ? primary : button} aria-current={tab === id ? "page" : undefined} href={"/musicas?aba=" + id}>{name}</Link>)}
    </nav>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{error} <button className={button} onClick={() => { setError(""); reload((value) => value + 1); }}>Atualizar</button></p>}
    {!library && !error && <p role="status">Carregando biblioteca…</p>}
    {library && <>
      {song && <SongEditor key={song.id} initial={song} close={(confirmed) => {
        if (confirmed) { setSong(undefined); reload((value) => value + 1); }
      }} />}
      {set && <div hidden={Boolean(song)}><SetEditor key={set.id} initial={set} songs={library.songs}
        close={() => { setSet(undefined); reload((value) => value + 1); }}
        createSong={() => newSong()} /></div>}
      {!song && !set && <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={panel}><strong className="block text-2xl">{library.songs.length}</strong>Músicas cadastradas</div>
          <div className={panel}><strong className="block text-2xl">{library.sets.length}</strong>Repertórios</div>
          <div className={panel}><strong className="block">Usados recentemente</strong>
            {recent.length ? recent.map((set) => <button key={set.id} className="block text-left text-teal-800 underline" onClick={() => setSet(set)}>{set.name}</button>) : <p className="text-sm text-zinc-500">As apresentações recentes aparecem aqui.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={primary} onClick={() => newSong()}>Adicionar música</button>
          <button className={button} onClick={() => setSet({ ...emptySet, id: crypto.randomUUID(), revision: 0, playedAt: null })}>Criar repertório</button>
          <Link className={button} href="/musicas?aba=ao-vivo">Iniciar apresentação</Link>
        </div>
        {tab !== "ao-vivo" && <label className="block">{tab === "musicas" ? "Pesquisar música ou artista" : "Pesquisar repertório"}
          <input className={field} type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>}
        {tab === "musicas" && <ul className="space-y-2">
          {library.songs.filter((song) => matches(search, song.title, song.artist, song.genre)).map((song) => <li key={song.id} className={panel + " flex flex-wrap items-center justify-between gap-2"}>
            <div><strong>{song.title}</strong><p className="text-sm text-zinc-600">{[song.artist, song.key || song.originalKey, song.genre].filter(Boolean).join(" · ")}</p></div>
            <div className="flex gap-2">
              <button disabled={busy} className={button} onClick={() => void task(async () => setSong(await musicApi<Song>(undefined, "?song=" + song.id)))}>Editar</button>
              <button disabled={busy} className={button} onClick={() => { if (window.confirm("Excluir esta música da biblioteca?")) void task(() => musicApi({ action: "song-delete", id: song.id }), true); }}>Excluir</button>
            </div>
          </li>)}
          {!library.songs.length && <li className={panel}>Adicione ou importe sua primeira música.</li>}
        </ul>}
        {tab === "repertorios" && <ul className="space-y-2">
          {library.sets.filter((set) => matches(search, set.name, set.description)).map((set) => <li key={set.id} className={panel + " flex flex-wrap items-center justify-between gap-2"}>
            <div><strong>{set.name}</strong><p className="text-sm text-zinc-600">{set.items.length} músicas {set.date && "· " + set.date}</p></div>
            <div className="flex flex-wrap gap-2">
              <button className={button} onClick={() => setSet(set)}>Organizar</button>
              <button className={button} onClick={() => setSet({ ...set, name: (set.name + " (cópia)").slice(0, 160), id: crypto.randomUUID(), revision: 0, playedAt: null })}>Duplicar</button>
              <button disabled={busy} className={button} onClick={() => { if (window.confirm("Excluir este repertório e encerrar suas sessões?")) void task(() => musicApi({ action: "set-delete", id: set.id }), true); }}>Excluir</button>
            </div>
          </li>)}
          {!library.sets.length && <li className={panel}>Crie um repertório com músicas da sua biblioteca.</li>}
        </ul>}
        {tab === "ao-vivo" && <div className="grid gap-3 lg:grid-cols-2">
          <section className={panel + " space-y-2"}>
            <h2 className="text-lg font-bold">Começar pelo repertório</h2>
            {library.sets.filter((set) => set.items.length).map((set) =>
              <Link className={button + " block"} key={set.id} href={stagePath + "?repertorio=" + set.id + "&revisao=" + set.revision}>{set.name}</Link>)}
            {!library.sets.some((set) => set.items.length) && <p>Adicione músicas a um repertório para abrir o palco.</p>}
          </section>
          <section className={panel + " space-y-2"}>
            <h2 className="text-lg font-bold">Entrar com convite</h2>
            <form className="space-y-2" action={stagePath}>
              <label>Código da sessão<input className={field} name="convite" autoComplete="off" required minLength={12} maxLength={12} value={code} onChange={(event) => setCode(event.target.value.trim())} /></label>
              <button className={primary}>Entrar</button>
            </form>
          </section>
          <section className={panel + " space-y-2 lg:col-span-2"}>
            <h2 className="text-lg font-bold">Minhas sessões recentes</h2>
            {!library.sessions.length && <p>Nenhuma sessão iniciada.</p>}
            {library.sessions.map((session) => <div key={session.id} className="flex flex-wrap items-center gap-3">
              <strong>{session.name}</strong>{session.ended ? <span>Encerrada</span> : <Link className={button} href={stagePath + "?sessao=" + session.id}>Abrir sessão</Link>}
            </div>)}
          </section>
        </div>}
      </>}
    </>}
  </div>;
}
