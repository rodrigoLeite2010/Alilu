"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MusicApiError, musicApi } from "@/lib/music/client";
import { POLL_MS, clip, positionAt } from "@/lib/music/playback";
import { trackSpeed, type Live, type Playback, type Program } from "@/lib/music/types";
import { Chart } from "./Chart";
import { button, field, primary } from "./SongEditor";

function getDevice() {
  return crypto.randomUUID();
}

const initialPlayback: Playback = { index: 0, position: 0, speed: 35, extent: 0, playing: false };

export function Stage({ code, sessionId, setId, revision }: {
  code: string; sessionId: string; setId: string; revision: number;
}) {
  const [live, setLive] = useState<Live>();
  const [program, setProgram] = useState<Program>();
  const [device, setDevice] = useState("");
  const [error, setError] = useState("");
  const [network, setNetwork] = useState(true);
  const [loading, setLoading] = useState(Boolean(code || sessionId || (setId && !revision)));
  const [busy, setBusy] = useState(false);
  const request = useRef<Promise<{ device: string; live?: Live; program?: Program }> | null>(null);
  const latest = useRef<Live | undefined>(undefined);
  const controlling = useRef(false);

  const accept = useCallback((value: Live) => {
    if (latest.current && latest.current.version > value.version) return;
    if (latest.current?.ended && !value.ended) return;
    if (latest.current?.version === value.version) {
      value = { ...value, state: latest.current.state };
    }
    latest.current = value;
    if (value.program) setProgram(value.program);
    setLive(value);
  }, []);

  const boot = useCallback(async (start: boolean) => {
    if (!request.current) {
      const device = getDevice();
      request.current = (async () => {
        if (code || sessionId || start) {
          const live = await musicApi<Live>(start
            ? { action: "start", id: setId, revision, device }
            : { action: "join", code, id: sessionId, device });
          return { device, live };
        }
        return { device, program: await musicApi<Program>({ action: "program", id: setId }) };
      })();
    }
    try {
      const result = await request.current;
      setDevice(result.device);
      if (result.live) {
        accept(result.live);
        if (start) history.replaceState(null, "", "/musicas/palco?sessao=" + result.live.id);
      }
      if (result.program) setProgram(result.program);
      setError("");
    } catch (error) {
      request.current = null;
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accept, code, sessionId, setId, revision]);

  useEffect(() => {
    if (code || sessionId || (setId && !revision)) {
      const timer = setTimeout(() => void boot(false), 0);
      return () => clearTimeout(timer);
    }
  }, [boot, code, revision, sessionId, setId]);

  const id = live?.id;
  const ended = live?.ended;
  useEffect(() => {
    if (!id || !device || ended) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let presence = performance.now();
    async function poll() {
      try {
        const sentAt = performance.now();
        const state = await musicApi<Live>({ action: "live-read", id, device, loaded: true }, "", controller.signal);
        state.serverTime = new Date(Date.parse(state.serverTime) + (performance.now() - sentAt) / 2).toISOString();
        if (controller.signal.aborted) return;
        accept(state);
        setNetwork(true);
        failures = 0;
        if (state.ended) return;
        if (performance.now() - presence >= 15000) {
          presence = performance.now();
          void musicApi({ action: "presence", id, device }, "", controller.signal).catch(() => {});
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof MusicApiError && [401, 403, 404].includes(error.status)) {
          if (latest.current) accept({ ...latest.current, ended: true, program: undefined });
          setError(error.message);
          return;
        }
        failures++;
        setNetwork(false);
      }
      timer = setTimeout(poll, document.hidden ? 5000 : Math.min(POLL_MS * 2 ** failures, 8000));
    }
    timer = setTimeout(poll, POLL_MS);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [accept, device, ended, id]);

  async function control(state: Playback, target?: string, end = false) {
    const current = latest.current;
    if (!current || controlling.current || !navigator.onLine || current.ended) return;
    controlling.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await musicApi<Live>({ action: "control", id: current.id, device, version: current.version, state, target, end });
      accept(next);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      controlling.current = false;
      setBusy(false);
    }
  }

  if (!program || ended) return <section className="mx-auto max-w-xl space-y-4 p-6">
    <Link className={button} href="/musicas?aba=ao-vivo">Voltar a Músicas</Link>
    <h1 className="text-3xl font-bold">Modo Palco</h1>
    {ended ? <p role="status">Esta apresentação foi encerrada.</p>
      : loading ? <p role="status">Abrindo repertório…</p>
      : revision > 0 ? <button className={primary} onClick={() => { setLoading(true); void boot(true); }}>Iniciar sessão ao vivo</button>
      : (code || sessionId || setId) ? <button className={primary} onClick={() => { setLoading(true); void boot(false); }}>Tentar abrir novamente</button>
      : <p>Selecione um repertório ou entre com um convite.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;

  return <StagePlayer program={program} live={live} network={network} busy={busy} error={error}
    control={control} leave={() => { if (id) void musicApi({ action: "leave", id, device }).catch(() => {}); }} />;
}

function StagePlayer({ program, live, network, busy, error, control, leave }: {
  program: Program; live?: Live; network: boolean; busy: boolean; error: string;
  control: (state: Playback, target?: string, end?: boolean) => Promise<void>; leave: () => void;
}) {
  const [local, setLocal] = useState<Playback>({ ...initialPlayback, speed: trackSpeed(program.tracks[0]) });
  const [dark, setDark] = useState(true);
  const [font, setFont] = useState(24);
  const [showChords, setShowChords] = useState(true);
  const [pitch, setPitch] = useState<{ index: number; key: string }>();
  const [finish, setFinish] = useState(program.finish);
  const [waiting, setWaiting] = useState(false);
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [speedInput, setSpeedInput] = useState<number>();
  const stage = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const lastFrame = useRef(0);
  const manual = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manualOverride = useRef(false);
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrolledTo = useRef(0);
  const endHandled = useRef(false);
  const following = Boolean(live && !live.leader);
  const synchronized = Boolean(live && (!following || program.sync === "scroll"));
  const canScroll = !following || program.sync === "song";
  const canChange = !live || live.leader;
  const shared = live?.state;
  const index = shared?.index ?? local.index;
  const independent = local.index === index ? local : { ...initialPlayback, index, speed: trackSpeed(program.tracks[index]) };
  if (following && local.index !== index) setLocal(independent);
  const playback = synchronized && shared ? shared : independent;
  const { playing, position: anchor, speed: playbackSpeed, extent: playbackExtent } = playback;
  const track = program.tracks[index];
  const next = program.tracks[index + 1];

  const localControl = useCallback((state: Playback) => {
    lastFrame.current = performance.now();
    setLocal(state);
  }, []);
  const act = useCallback((state: Playback) => {
    if (synchronized) return control(state);
    localControl(state);
    return Promise.resolve();
  }, [control, localControl, synchronized]);

  const cancelDelay = useCallback(() => {
    clearTimeout(delay.current);
    delay.current = undefined;
    setWaiting(false);
  }, []);

  const select = useCallback((index: number, playing = false) => {
    if (!canChange || index < 0 || index >= program.tracks.length) return;
    cancelDelay();
    clearTimeout(manual.current);
    manualOverride.current = false;
    void act({ index, playing, speed: trackSpeed(program.tracks[index]), position: 0, extent: 0 });
  }, [act, canChange, cancelDelay, program.tracks]);

  const end = useCallback((state: Playback) => {
    if (!canScroll || busy || (live && !network)) return;
    if (finish === "play" || finish === "advance") {
      if (canChange && next) { select(index + 1, finish === "play"); return; }
    }
    void act({ ...state, playing: false, position: 1 });
    if (finish === "delay" && canChange && next) {
      setWaiting(true);
      delay.current = setTimeout(() => select(index + 1), program.delay * 1000);
    }
  }, [act, busy, canChange, canScroll, finish, index, live, network, next, program.delay, select]);
  const endCallback = useRef(end);
  useEffect(() => { endCallback.current = end; }, [end]);

  const version = live?.version;
  const updatedAt = live?.updatedAt;
  // Refreshing the same version must preserve the current animation origin.
  const clock = useRef({ age: 0, received: 0 });
  useEffect(() => {
    if (live) clock.current = {
      age: Math.max(0, Date.parse(live.serverTime) - Date.parse(live.updatedAt)),
      received: performance.now(),
    };
  }, [live]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const start = lastFrame.current || performance.now();
    const animationState = { index, position: anchor, speed: playbackSpeed, extent: playbackExtent || Math.max(1, element.scrollHeight - element.clientHeight), playing };
    if (synchronized && !playbackExtent) animationState.extent = 1000;
    let animation = 0;
    endHandled.current = false;
    function frame(now: number) {
      if (!element) return;
      if (!manualOverride.current) {
        const extent = element.scrollHeight - element.clientHeight;
        const elapsed = synchronized ? clock.current.age + now - clock.current.received : now - start;
        const desired = positionAt(animationState, elapsed);
        const target = extent * desired;
        const delta = target - element.scrollTop;
        const corrected = synchronized && following && Math.abs(delta) < 140 && Math.abs(delta) > 1
          ? element.scrollTop + delta * 0.25 : target;
        element.scrollTop = corrected;
        scrolledTo.current = element.scrollTop;
        position.current = desired;
        if (playing && (desired >= 1 || extent <= 0) && !endHandled.current && canScroll && !busy && (!synchronized || network)) {
          endHandled.current = true;
          endCallback.current(animationState);
        }
      }
      animation = requestAnimationFrame(frame);
    }
    animation = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animation);
  }, [anchor, index, playbackSpeed, playbackExtent, playing, version, updatedAt, synchronized, following, canScroll, network, busy]);

  useEffect(() => () => { clearTimeout(delay.current); clearTimeout(manual.current); }, []);

  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let mounted = true;
    const acquire = async () => {
      if (document.hidden || !navigator.wakeLock || (lock && !lock.released)) return;
      const acquired = await navigator.wakeLock.request("screen").catch(() => undefined);
      if (!mounted) void acquired?.release();
      else lock = acquired;
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => { mounted = false; document.removeEventListener("visibilitychange", acquire); void lock?.release(); };
  }, []);

  const command = useCallback((patch: Partial<Playback>) => {
    if (!canScroll || busy || (synchronized && !network)) return;
    cancelDelay();
    clearTimeout(manual.current);
    manualOverride.current = false;
    const element = viewport.current;
    const extent = playback.extent || (element ? Math.max(1, element.scrollHeight - element.clientHeight) : 1000);
    void act({ ...playback, extent, position: position.current, ...patch });
  }, [act, busy, canScroll, cancelDelay, network, playback, synchronized]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.closest("input, select, textarea, [contenteditable]"))) return;
      const actionable = event.target instanceof HTMLElement && event.target.closest("button, a, summary");
      if (event.code === "Space" && canScroll && !actionable) { event.preventDefault(); command({ playing: !playback.playing }); }
      if (event.key === "ArrowRight" && canChange) { event.preventDefault(); select(index + 1); }
      if (event.key === "ArrowLeft" && canChange) { event.preventDefault(); select(index - 1); }
      if (event.key === "Home" && canScroll) { event.preventDefault(); command({ position: 0, playing: false }); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [canChange, canScroll, command, index, playback.playing, select]);

  useEffect(() => {
    viewport.current?.focus({ preventScroll: true });
  }, []);

  function manualScroll(element: HTMLDivElement) {
    if (!canScroll || busy || (synchronized && !network) || Math.abs(element.scrollTop - scrolledTo.current) < 1) return;
    cancelDelay();
    manualOverride.current = true;
    const extent = element.scrollHeight - element.clientHeight;
    position.current = extent > 0 ? clip(element.scrollTop / extent) : 0;
    clearTimeout(manual.current);
    manual.current = setTimeout(() => {
      manualOverride.current = false;
      void act({ ...playback, position: position.current, playing: false });
    }, 160);
  }

  const speed = speedInput ?? playback.speed;
  const invite = live?.code ? "/musicas/palco?convite=" + live.code : "";

  async function showQr() {
    if (qr) { setQr(""); return; }
    try {
      const { toDataURL } = await import("qrcode");
      setQr(await toDataURL(new URL(invite, location.origin).href, { width: 210, margin: 2 }));
    } catch {
      setMessage("Não foi possível gerar o QR Code.");
    }
  }

  return <section ref={stage} className={"fixed inset-0 z-[110] flex h-dvh flex-col overflow-hidden " +
    (dark ? "bg-zinc-950 text-zinc-50 [--music-chord:#5eead4]" : "bg-white text-zinc-950 [--music-chord:#0f766e]")}
    role="dialog" aria-modal="true" aria-label="Modo Palco" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button, input, select, summary, [tabindex='0']")]
        .filter((element) => !element.matches(":disabled") && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && event.target === first && last) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && event.target === last && first) { event.preventDefault(); first.focus(); }
    }}>
    <header className="shrink-0 border-b border-current/15 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide opacity-70">
            {program.name} · {live ? live.leader ? "Líder" : "Seguidor" : "Ensaio"} · {index + 1}/{program.tracks.length}
          </p>
          <h1 className="truncate text-xl font-bold sm:text-2xl">{track.song.title}</h1>
          <p className="truncate text-sm opacity-75">{[track.song.artist, pitch?.index === index && pitch.key || track.item.key || track.song.key || track.song.originalKey, track.song.capo && "Capo " + track.song.capo, track.song.bpm && track.song.bpm + " BPM"].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button className={button} onClick={() => setDark(!dark)}>{dark ? "Tema claro" : "Tema escuro"}</button>
          <button className={button} onClick={() => {
            const action = document.fullscreenElement ? document.exitFullscreen() : stage.current?.requestFullscreen?.();
            if (action) void action.catch(() => setMessage("Tela cheia indisponível neste dispositivo."));
            else setMessage("Tela cheia indisponível neste dispositivo.");
          }}>Tela cheia</button>
          <Link className={button} href={live ? "/musicas?aba=ao-vivo" : "/musicas?aba=repertorios"} onClick={leave}>Sair</Link>
        </div>
      </div>
      {!network && <p role="status" className="text-sm">Conexão interrompida. Reconectando…</p>}
      {(error || message) && <p role="status" className="text-sm">{error || message}</p>}
    </header>
    <div key={track.item.id} ref={viewport} tabIndex={0} aria-label="Letra da música"
      className={"min-h-0 flex-1 overscroll-contain px-4 py-4 sm:px-8 " + (canScroll ? "overflow-y-auto" : "overflow-y-hidden")}
      onScroll={(event) => manualScroll(event.currentTarget)}>
      <div className="mx-auto max-w-5xl">
        <Chart song={track.song} target={pitch?.index === index && pitch.key || track.item.key} font={font} chords={showChords} />
        {(track.item.notes || track.song.notes) && <p className="mt-5 whitespace-pre-wrap text-sm opacity-70">{[track.song.notes, track.item.notes].filter(Boolean).join("\n")}</p>}
      </div>
    </div>
    <footer className="shrink-0 border-t border-current/15 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6">
      {canChange && <div className="flex flex-wrap items-center gap-1">
        <button className={button} disabled={!index || busy || !network} onClick={() => select(index - 1)}>Anterior</button>
        <button className={button} disabled={!next || busy || !network} onClick={() => select(index + 1)}>Próxima</button>
        <label className="min-w-0 max-w-52"><span className="sr-only">Selecionar música</span>
          <select className={field} value={index} disabled={busy || !network} onChange={(event) => select(+event.target.value)}>
            {program.tracks.map(({ item, song }, position) => <option key={item.id} value={position}>{position + 1}. {song.title}</option>)}
          </select>
        </label>
        {next && <span className="truncate text-sm opacity-75">A seguir · {next.song.title}</span>}
      </div>}
      {canScroll && <div className="flex flex-wrap items-center gap-1 pt-1">
        <button className={button} disabled={busy || (synchronized && !network)} onClick={() => command({ playing: !playback.playing })}>{playback.playing ? "Pausar" : "Iniciar rolagem"}</button>
        <button className={button} disabled={busy || (synchronized && !network)} onClick={() => command({ position: 0, playing: false })}>Reiniciar</button>
        <button className={button} disabled={speed <= 5 || busy || (synchronized && !network)} onClick={() => command({ speed: Math.max(5, speed - 5) })} aria-label="Reduzir velocidade">−</button>
        <label className="inline-flex items-center gap-1 text-sm">Velocidade {speed}
          <input className="w-20 sm:w-28" type="range" min={5} max={150} value={speed} disabled={synchronized && !network}
            onChange={(event) => setSpeedInput(+event.target.value)}
            onBlur={() => { if (speedInput !== undefined) { command({ speed: speedInput }); setSpeedInput(undefined); } }}
            onPointerUp={() => { if (speedInput !== undefined) { command({ speed: speedInput }); setSpeedInput(undefined); } }}
            onKeyUp={() => { if (speedInput !== undefined) { command({ speed: speedInput }); setSpeedInput(undefined); } }} />
        </label>
        <button className={button} disabled={speed >= 150 || busy || (synchronized && !network)} onClick={() => command({ speed: Math.min(150, speed + 5) })} aria-label="Aumentar velocidade">+</button>
        {waiting && <button className={button} onClick={cancelDelay}>Cancelar avanço</button>}
      </div>}
      <details className="mt-1 max-h-[36dvh] overflow-y-auto text-sm">
        <summary className="cursor-pointer py-1">Preferências {invite && "e convite"}</summary>
        <div className="flex flex-wrap items-center gap-2 py-1">
          <label className="flex items-center gap-1">Fonte<input type="range" min={14} max={48} value={font} onChange={(event) => setFont(+event.target.value)} /></label>
          <label><input type="checkbox" checked={showChords} onChange={(event) => setShowChords(event.target.checked)} /> Mostrar acordes</label>
          <label>Tom local <input className={field + " max-w-24"} maxLength={8} placeholder={track.item.key || track.song.key || track.song.originalKey || "C"}
            value={pitch?.index === index ? pitch.key : ""} onChange={(event) => setPitch({ index, key: event.target.value })} /></label>
          {canChange && <label>Ao terminar <select className={field + " w-auto"} value={finish} onChange={(event) => { cancelDelay(); setFinish(event.target.value as Program["finish"]); }}>
            <option value="manual">Aguardar</option><option value="advance">Avançar</option><option value="play">Avançar e rolar</option><option value="delay">Avançar após {program.delay}s</option>
          </select></label>}
        </div>
        {invite && <div className="space-y-2 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <span>Código <strong className="font-mono">{live?.code}</strong></span>
            <button className={button} onClick={() => {
              void navigator.clipboard.writeText(new URL(invite, location.origin).href)
                .then(() => setMessage("Link copiado.")).catch(() => setMessage("Use o código para compartilhar o convite."));
            }}>Copiar link</button>
            <button className={button} onClick={() => void showQr()}>{qr ? "Ocultar QR Code" : "Mostrar QR Code"}</button>
          </div>
          {qr && <div style={{ backgroundImage: "url(" + qr + ")" }} role="img" aria-label="QR Code do convite" className="h-[210px] w-[210px]" />}
        </div>}
        {live?.devices && <div className="flex flex-wrap items-center gap-2">
          <span>{live.devices.length} dispositivo(s) · sua tela {live.participant.slice(0, 6)}</span>
          {live.owner && !live.leader && <button className={button} disabled={busy || !network}
            onClick={() => void control({ ...live.state, playing: false }, live.participant)}>Assumir controle</button>}
          {live.leader && live.devices.filter((entry) => entry.participant !== live.participant).map((entry) =>
            <button key={entry.participant} className={button} disabled={busy || !network} onClick={() => {
              if (window.confirm("Transferir o controle da apresentação?")) void control({ ...playback, position: position.current, playing: false }, entry.participant);
            }}>Transferir para {entry.participant.slice(0, 6)}</button>)}
        </div>}
        {(live?.owner || live?.leader) && <button className={button} disabled={busy || !network} onClick={() => {
          if (window.confirm("Encerrar a sessão para todos?")) void control({ ...live.state, playing: false }, undefined, true);
        }}>Encerrar sessão</button>}
      </details>
    </footer>
  </section>;
}
