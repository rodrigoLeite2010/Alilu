"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
type Entry = { state: string; city: string; fuel: string; price: number; stations: number };
type Snapshot = { from: string; to: string; source: string; entries: Entry[] };
export function AnpPrices({ fuel, onApply }: { fuel: string; onApply: (price: number) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [state, setState] = useState(""), [city, setCity] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const available = snapshot?.entries.filter(e => e.fuel === fuel) ?? [];
  const selected = available.find(e => e.state === state && e.city === city);
  async function load() {
    setBusy(true); setError("");
    try { const r = await fetch("/data/viagens/anp-prices.json"); if (!r.ok) throw new Error(); const data = await r.json(); if (!Array.isArray(data.entries)) throw new Error(); setStale(Date.now() - Date.parse(data.to) > 21 * 86400000); setSnapshot(data); }
    catch { setError("Pesquisa indisponível. Continue com o preço manual."); } finally { setBusy(false); }
  }
  const cls = "min-h-11 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm";
  return <div className="sm:col-span-2 space-y-3 rounded-lg border border-brand-primary/20 bg-brand-primary-soft p-4"><p className="font-semibold text-brand-primary">Preço de referência da ANP</p><p className="text-sm text-zinc-600">Consulte uma cópia local da pesquisa oficial. Não é cotação em tempo real nem garantia de preço no posto.</p>{!snapshot ? <Button variant="secondary" disabled={busy} onClick={load}>{busy ? "Carregando…" : "Consultar médias oficiais"}</Button> : <><p className="text-xs">Pesquisa: {snapshot.from.split("-").reverse().join("/")} a {snapshot.to.split("-").reverse().join("/")}. <a className="underline" href={snapshot.source} target="_blank" rel="noreferrer">Planilha original ANP</a>.</p>{stale && <p className="text-sm text-amber-900">Pesquisa com mais de 21 dias. Use apenas como referência histórica e confirme o preço atual antes de aplicar.</p>}<div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Estado da pesquisa</span><select className={cls} value={state} onChange={e => { setState(e.target.value); setCity(""); }}><option value="">Selecione</option>{[...new Set(available.map(e => e.state))].sort().map(s => <option key={s}>{s}</option>)}</select></label><label className="space-y-1 text-sm"><span>Município ou média estadual</span><select className={cls} value={city} onChange={e => setCity(e.target.value)}><option value="">Média do estado</option>{available.filter(e => e.state === state && e.city).sort((a, b) => a.city.localeCompare(b.city)).map(e => <option key={e.city}>{e.city}</option>)}</select></label></div>{selected ? <div className="space-y-2"><p className="text-sm">{selected.city || `Estado: ${selected.state}`} · {fuel} · {selected.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/L · {selected.stations} postos pesquisados.</p><Button variant="secondary" onClick={() => onApply(selected.price)}>Usar este preço como estimativa</Button></div> : <p className="text-sm">Selecione um estado com dados para o combustível escolhido. Municípios sem amostra não aparecem; você pode usar a média estadual identificada ou informar manualmente.</p>}</>}{error && <p role="status" className="text-sm text-amber-900">{error}</p>}</div>;
}
