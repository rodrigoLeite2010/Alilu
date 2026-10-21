"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useHeaderAuth } from "@/components/layout/useHeaderAuth";
import { AnpPrices } from "./AnpPrices";
import { calculateTrip, cents, costLabels, expenseCategories, generateChecklist, money, newTrip, parseTrip, routeSignature, tripDays, tripSummary, type CostKey, type Trip, type RouteEstimate, type ExpenseCategory } from "@/lib/viagens/planner";
import type { SavedTrip } from "@/lib/viagens/repository";

const tabs = ["Minha viagem", "Transporte", "Orçamento", "Checklist", "Roteiro", "Resumo"];
const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-primary focus:outline-2 focus:outline-brand-primary/20";
const DRAFT_KEY = "alilu:viagem:rascunho:v1";
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block min-w-0 space-y-1.5 text-sm font-medium text-zinc-700"><span>{label}</span>{children}{hint && <span className="block text-xs font-normal text-zinc-500">{hint}</span>}</label>;
}
function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-6"><h3 className="text-lg font-semibold text-brand-primary">{title}</h3>{note && <p className="text-sm text-zinc-600">{note}</p>}<div className="grid gap-4 sm:grid-cols-2">{children}</div></section>;
}
function NumberInput({ label, value, onChange, max = 10000000, step = "0.01", hint }: { label: string; value: number | null; onChange: (n: number | null) => void; max?: number; step?: string; hint?: string }) {
  return <Field label={label} hint={hint}><input className={inputClass} type="number" inputMode={step === "1" ? "numeric" : "decimal"} min="0" max={max} step={step} value={value === null ? "" : value} placeholder={value === null ? "Não informado" : "0"} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(e.target.value === "" ? null : Math.max(0, Math.min(max, step === "1" ? Math.round(n) : n))); }} /></Field>;
}
function RouteSketch({ route }: { route: RouteEstimate }) {
  const coords = route.coordinates;
  if (coords.length < 2) return null;
  const xs = coords.map(p => p[0]), ys = coords.map(p => p[1]), minX = Math.min(...xs), minY = Math.min(...ys), dx = Math.max(...xs) - minX || 1, dy = Math.max(...ys) - minY || 1;
  return <figure className="sm:col-span-2 rounded-lg bg-brand-primary-soft p-3"><svg viewBox="0 0 600 240" className="h-48 w-full" role="img" aria-label="Traçado aproximado da rota consultada, sem mapa de fundo"><polyline points={coords.map(p => `${20 + (p[0] - minX) / dx * 560},${220 - (p[1] - minY) / dy * 200}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand-primary" /></svg><figcaption className="text-xs text-zinc-600">Traçado esquemático, sem escala uniforme. Dados © openrouteservice / OpenStreetMap contributors. Confirme os locais: {route.labels.join(" → ")}. Não inclui trânsito nem tempo de paradas.</figcaption></figure>;
}

export function TravelPlanner() {
  const [trip, setTrip] = useState<Trip>(newTrip);
  const [tab, setTab] = useState(0), [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false), [routeBusy, setRouteBusy] = useState(false);
  const [trips, setTrips] = useState<SavedTrip[]>([]), [current, setCurrent] = useState<{ id: string; revision: number; archived: boolean } | null>(null);
  const [localAvailable, setLocalAvailable] = useState(false), [share, setShare] = useState(false), [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [actualTitle, setActualTitle] = useState(""), [actualAmount, setActualAmount] = useState<number | null>(null), [actualCategory, setActualCategory] = useState<ExpenseCategory>("Transporte");
  const [actualDate, setActualDate] = useState("");
  const auth = useHeaderAuth();
  useEffect(() => {
    try { setLocalAvailable(Boolean(localStorage.getItem(DRAFT_KEY))); } catch { /* Storage may be disabled. */ }
    const selected = Number(new URLSearchParams(window.location.search).get("aba")); if (selected >= 0 && selected < tabs.length) setTab(selected);
    setActualDate(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  }, []);
  const summary = calculateTrip(trip);
  const driving = ["carro", "moto"].includes(trip.transport);
  function update<K extends keyof Trip>(key: K, value: Trip[K]) { setTrip(t => ({ ...t, [key]: value })); }
  function num(key: keyof Trip, label: string, max?: number, step?: string, hint?: string) {
    return <NumberInput key={key} label={label} value={trip[key] as number | null} max={max} step={step} hint={hint} onChange={v => update(key, (["tollOut", "tollBack", "nightsOverride"].includes(key) ? v : v ?? 0) as never)} />;
  }
  function text(key: keyof Trip, label: string, type = "text", hint?: string) {
    return <Field key={key} label={label} hint={hint}><input className={inputClass} type={type} maxLength={180} value={trip[key] as string} onChange={e => update(key, e.target.value as never)} /></Field>;
  }
  function select(key: keyof Trip, label: string, options: string[]) {
    return <Field label={label}><select className={inputClass} value={trip[key] as string} onChange={e => update(key, e.target.value as never)}>{options.map(o => <option key={o}>{o}</option>)}</select></Field>;
  }
  function costs(keys: CostKey[]) { return keys.map(key => <NumberInput key={key} label={`${costLabels[key]} (R$)`} value={trip.costs[key]} onChange={v => setTrip(t => ({ ...t, costs: { ...t.costs, [key]: v ?? 0 } }))} />); }
  async function request(url: string, options?: RequestInit) {
    const r = await fetch(url, { ...options, headers: { "Content-Type": "application/json" }, cache: "no-store" });
    const data = await r.json(); if (!r.ok) throw new Error(data.error || "Serviço indisponível."); return data;
  }
  async function loadList() {
    setBusy(true); try { const data = await request("/api/viagens"); setTrips(data.trips); setMessage("Lista da conta atualizada."); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function save(asCopy = false, archive = current?.archived ?? false) {
    setBusy(true);
    try {
      const plan = parseTrip(asCopy ? { ...trip, title: `${trip.title.slice(0, 170)} (cópia)` } : trip);
      const data = await request("/api/viagens", { method: "POST", body: JSON.stringify({ plan, id: asCopy ? null : current?.id ?? null, revision: asCopy ? 0 : current?.revision ?? 0, archived: archive }) });
      setTrip(data.trip.plan); setCurrent(data.trip); setTrips(list => [data.trip, ...list.filter(t => t.id !== data.trip.id)]); setMessage(asCopy ? "Cópia salva na sua conta." : "Viagem salva na sua conta.");
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); try { await request(`/api/viagens?id=${id}`, { method: "DELETE" }); setTrips(list => list.filter(t => t.id !== id)); if (current?.id === id) setCurrent(null); setMessage("Viagem excluída da conta. Os campos continuam nesta tela."); setConfirmDelete(null); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function getRoute() {
    const signature = routeSignature(trip); setRouteBusy(true); setMessage("");
    try {
      const data = await request("/api/viagens/rota", { method: "POST", body: JSON.stringify({ origin: trip.origin, destination: trip.destination, stops: trip.stops, roundTrip: trip.roundTrip }) });
      setTrip(t => routeSignature(t) === signature ? { ...t, route: data.route, distance: data.route.distance / (t.roundTrip ? 2 : 1), minutes: data.route.minutes / (t.roundTrip ? 2 : 1) } : t);
      setMessage("Rota consultada. Confira os locais identificados no traçado.");
    } catch (e) { setMessage((e as Error).message); } finally { setRouteBusy(false); }
  }
  async function exportPdf() {
    setBusy(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      pdf.setTitle(`Planejamento Alilu - ${trip.title}`); pdf.setCreator("Planejador de Viagem Alilu");
      let page = pdf.addPage([595.28, 841.89]), y = 795;
      const lines = [tripSummary(trip), "", "CHECKLIST", ...trip.checklist.map(i => `${i.done ? "[OK]" : "[ ]"} ${i.group}: ${i.text} (${i.quantity}) - ${i.kind}`), "", "MEU ROTEIRO", ...[...trip.itinerary].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).map(a => `Dia ${a.day}, ${a.time || "sem horário"}: ${a.title} - ${money(cents(a.cost))}`), "", "GASTOS REAIS", ...trip.actual.map(a => `${a.date} - ${a.category}: ${a.title} - ${money(cents(a.amount))}`)].join("\n").replaceAll("→", ">").replaceAll("•", "-").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "-").split("\n");
      for (const line of lines) {
        const words = line.split(/\s+/); let wrapped = "";
        const heading = ["CHECKLIST", "MEU ROTEIRO", "GASTOS REAIS"].includes(line) || line.startsWith("Planejamento Alilu");
        const draw = (s: string) => { if (y < (heading ? 105 : 65)) { page = pdf.addPage([595.28, 841.89]); y = 795; } page.drawText(s, { x: 42, y, size: 10, font: heading ? bold : font, color: rgb(0.12, 0.22, 0.23) }); y -= heading ? 22 : 16; };
        for (const word of words) {
          // Split long unbroken user text too, so no content overflows the page.
          for (const chunk of word.match(/.{1,70}/g) ?? [""]) {
            if ((heading ? bold : font).widthOfTextAtSize(`${wrapped} ${chunk}`, 10) > 505 && wrapped) { draw(wrapped); wrapped = ""; }
            wrapped = wrapped ? `${wrapped} ${chunk}` : chunk;
          }
        }
        draw(wrapped);
      }
      pdf.getPages().forEach((p, i) => p.drawText(`ALILU - Estimativas de viagem | ${i + 1} / ${pdf.getPageCount()}`, { x: 42, y: 30, size: 8, font, color: rgb(0.35, 0.4, 0.4) }));
      const bytes = await pdf.save(); const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = "planejamento-alilu.pdf"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); setMessage("PDF gerado no seu navegador.");
    } catch { setMessage("Não foi possível gerar o PDF. Use Imprimir / salvar PDF."); } finally { setBusy(false); }
  }
  function saveLocal() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(parseTrip(trip))); setLocalAvailable(true); setMessage("Rascunho salvo apenas neste navegador. Evite dispositivos compartilhados."); return true; } catch (e) { setMessage(`Não foi possível salvar: ${(e as Error).message}`); return false; } }
  function restoreLocal() { try { setTrip(parseTrip(JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"))); setCurrent(null); setMessage("Rascunho restaurado. Confira os valores manuais de distância."); } catch { setMessage("Rascunho inválido ou indisponível."); } }

  return <div className="space-y-5">
    <div className="rounded-2xl bg-brand-primary p-5 text-white sm:p-7 print:bg-white print:text-black">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-white/75 print:text-black">Planejador de Viagem Alilu</p><h2 className="mt-1 text-2xl font-bold">Sua próxima viagem começa aqui.</h2><p className="mt-2 text-sm text-white/85 print:text-black">Organize os custos, prepare a mala e monte seu roteiro. Grátis.</p></div><Icon name="plane" className="hidden h-10 w-10 shrink-0 sm:block" /></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total estimado", money(summary.total)], ["Por pessoa", money(summary.perPerson)], ["Transporte", money(summary.categories.Transporte)], ["Orçamento disponível", money(cents(trip.budget))]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/10 p-3 print:border"><p className="text-xs text-white/80 print:text-black">{label}</p><p className="mt-1 break-words text-xl font-semibold">{value}</p></div>)}</div>
      <p className="mt-3 text-xs text-white/80 print:text-black">Estimativas com os valores informados. {summary.warnings.length ? "Há informações pendentes; confira o resumo." : "Valores sujeitos a alterações."}</p>
    </div>

    <details className="rounded-xl border border-zinc-200 bg-white p-4 print:hidden"><summary className="min-h-8 cursor-pointer font-semibold text-brand-primary">Salvar e gerenciar minhas viagens</summary><div className="mt-4 space-y-4">
      <p className="text-sm text-zinc-600">Os campos ficam nesta tela até você sair. Salve explicitamente um rascunho no dispositivo ou na sua conta. Nenhum link público da viagem é criado.</p>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={saveLocal}>Salvar rascunho neste dispositivo</Button>{localAvailable && <><Button variant="ghost" onClick={restoreLocal}>Restaurar rascunho</Button><Button variant="ghost" onClick={() => { try { localStorage.removeItem(DRAFT_KEY); setLocalAvailable(false); setMessage("Rascunho removido deste dispositivo."); } catch { setMessage("Não foi possível remover o rascunho."); } }}>Apagar rascunho local</Button></>}</div>
      {auth.status === "signed-in" ? <><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => save()}>Salvar na conta</Button><Button disabled={busy} variant="secondary" onClick={() => save(true)}>Duplicar na conta</Button><Button disabled={busy} variant="secondary" onClick={loadList}>Carregar minhas viagens</Button>{current && <Button disabled={busy} variant="ghost" onClick={() => save(false, !current.archived)}>{current.archived ? "Desarquivar" : "Arquivar"}</Button>}</div><ul className="space-y-2">{trips.map(t => <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3"><span className="min-w-0 flex-1 break-words text-sm">{t.plan.title} {t.archived && "(arquivada)"}</span><Button variant="ghost" disabled={busy} onClick={() => { try { setTrip(parseTrip(t.plan)); setCurrent(t); setMessage("Viagem carregada. Alterações ainda não salvas serão substituídas ao abrir outra viagem."); } catch { setMessage("Esta viagem contém dados inválidos."); } }}>Abrir</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(t.id)}>Excluir</Button>{confirmDelete === t.id && <div className="w-full rounded-lg bg-red-50 p-3 text-sm"><p>Excluir permanentemente esta viagem da conta?</p><div className="mt-2 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => remove(t.id)}>Confirmar exclusão</Button><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button></div></div>}</li>)}</ul></> : <p className="text-sm"><Link className="font-semibold text-brand-primary underline" href="/entrar?callbackUrl=%2Fviagens%2Fplanejador-de-viagem">Entre na sua conta</Link> para salvar, duplicar, arquivar e reabrir várias viagens.</p>}
      <Button variant="ghost" onClick={() => { if (saveLocal()) { setTrip(newTrip()); setCurrent(null); setTab(0); } }}>Começar nova viagem (salva rascunho atual)</Button>
    </div></details>
    <p role="status" aria-live="polite" className="text-sm font-medium text-brand-primary print:hidden">{busy ? "Processando… " : ""}{message}</p>
    <nav aria-label="Etapas do planejamento" className="sticky top-14 z-10 -mx-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 md:top-16 print:hidden"><div className="flex min-w-max gap-1">{tabs.map((title, index) => <button key={title} type="button" aria-current={tab === index ? "step" : undefined} className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${tab === index ? "bg-brand-primary text-white" : "text-zinc-600 hover:bg-brand-primary-soft"}`} onClick={() => { setTab(index); setShare(false); }}>{index + 1}. {title}</button>)}</div></nav>

    <div className={tab === 0 ? "space-y-4 print:hidden" : "hidden"}>
      <Section title="Para onde vamos?" note="Não precisamos de nomes de passageiros nem números de documentos.">
        {text("title", "Nome da viagem")}{select("purpose", "Motivo", ["férias", "praia", "campo", "negócios", "passeio", "visita familiar", "outro"])}
        {text("origin", "Cidade de origem", "text", "Inclua o estado, por exemplo: cidade, UF.")}{text("destination", "Cidade de destino")}
        <div className="sm:col-span-2 space-y-2">{trip.stops.map((stop, i) => <div key={i} className="flex items-end gap-2"><div className="flex-1"><Field label={`Parada ${i + 1}`}><input className={inputClass} maxLength={180} value={stop} onChange={e => update("stops", trip.stops.map((s, j) => i === j ? e.target.value : s))} /></Field></div><Button variant="ghost" onClick={() => update("stops", trip.stops.filter((_, j) => i !== j))} aria-label={`Remover parada ${i + 1}`}>Remover</Button></div>)}<Button variant="secondary" disabled={trip.stops.length >= 5} onClick={() => update("stops", [...trip.stops, ""])}>+ Adicionar parada</Button></div>
        {text("departure", "Data de saída", "date")}{text("returnDate", "Fim da viagem / retorno", "date")}
        <Field label="Trecho"><select className={inputClass} value={String(trip.roundTrip)} onChange={e => update("roundTrip", e.target.value === "true")}><option value="true">Ida e volta</option><option value="false">Somente ida</option></select></Field>
        {select("transport", "Meio de transporte", ["carro", "moto", "ônibus", "avião", "outro"])}
        {num("adults", "Adultos", 100, "1")}{num("children", "Crianças", 100, "1")}
        {trip.children > 0 && text("childAges", "Idades das crianças (opcional)", "text", "Separe por vírgula. Não informe nomes.")}
        <div className="rounded-lg bg-brand-primary-soft p-3 text-sm text-brand-primary">{summary.days} dia(s) e {summary.nights} noite(s). {tripDays(trip).valid ? "Calculados pelas datas." : "Preencha as datas para calcular a duração."}</div>
      </Section>
      <Section title="Preferências para a mala" note="Sem previsão meteorológica conectada. Informe o clima esperado; confira a previsão perto da saída.">
        {text("activities", "Atividades previstas", "text", "Ex.: trilha, piscina, reuniões.")}{select("climate", "Clima esperado (manual)", ["não informado", "quente", "frio", "chuva", "ameno"])}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={trip.pets} onChange={e => update("pets", e.target.checked)} />Vou viajar com animais</label>
      </Section>
    </div>

    <div className={tab === 1 ? "space-y-4 print:hidden" : "hidden"}>
      {driving ? <><Section title="Distância e duração" note="A distância manual é de ida, incluindo todas as paradas. A opção ida e volta multiplica esse valor por dois. Uma rota automática consulta os dois sentidos.">
        <div className="sm:col-span-2"><Button disabled={routeBusy} onClick={getRoute}>{routeBusy ? "Consultando…" : "Consultar rota rodoviária"}</Button><p className="mt-2 text-xs text-zinc-500">Requer integração habilitada e login; até 10 consultas/dia. Perfil rodoviário de carro; para moto, revise restrições específicas. Nenhuma chamada ocorre enquanto você digita.</p></div>
        <NumberInput label="Distância manual de ida (km)" value={trip.distance} onChange={v => setTrip(t => ({ ...t, distance: v ?? 0, route: null }))} />
        <NumberInput label="Duração manual de ida (minutos)" value={trip.minutes} onChange={v => setTrip(t => ({ ...t, minutes: v ?? 0, route: null }))} />
        <p className="sm:col-span-2 text-sm font-medium">Total: {summary.distance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km · {Math.floor(summary.minutes / 60)}h {Math.round(summary.minutes % 60)}min {trip.route?.signature === routeSignature(trip) ? "(openrouteservice)" : "(informação manual)"}</p>
        {trip.route?.signature === routeSignature(trip) && <RouteSketch route={trip.route} />}
      </Section><Section title="Combustível" note="Informe o consumo e o preço, ou aplique uma média da pesquisa oficial abaixo. O preço permanece editável.">
        {text("vehicle", "Veículo (opcional)")}{select("fuel", "Combustível", ["gasolina", "etanol", "diesel", "diesel S10", "outro"])}
        <AnpPrices fuel={trip.fuel} onApply={price => update("fuelPrice", price)} />
        {num("consumption", "Consumo rodoviário / médio (km/L)", 200)}{num("fuelPrice", "Preço por litro (R$)", 1000)}
        {num("urbanPercent", "Parcela urbana da distância (%)", 100)}{trip.urbanPercent > 0 && num("urbanConsumption", "Consumo urbano (km/L)", 200)}
        <p className="sm:col-span-2 text-sm">Litros previstos: {summary.liters.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} · Combustível: <strong>{money(summary.fuel)}</strong>. <a className="text-brand-primary underline" target="_blank" rel="noreferrer" href="https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas">Consultar pesquisa oficial da ANP</a> e verificar município, combustível e semana antes de preencher.</p>
      </Section><Section title="Pedágios por sentido" note="Sem fornecedor de pedágios conectado. Campos vazios deixam o total incompleto. Digite 0 para confirmar ausência de pedágios. Valores totais de todas as praças por sentido.">
        {num("tollOut", "Pedágios na ida (R$)")}{trip.roundTrip && num("tollBack", "Pedágios na volta (R$)")}
      </Section><Section title="Comparar com etanol" note="Compare com seu combustível selecionado. O cenário alternativo usa consumo médio para o trajeto completo informado por você.">
        {num("ethanolConsumption", "Consumo médio com etanol (km/L)", 200)}{num("ethanolPrice", "Preço do etanol (R$/L)", 1000)}
        {summary.ethanol !== null && <p className="sm:col-span-2 text-sm">Etanol: {money(summary.ethanol)} · Diferença para {trip.fuel}: {money(summary.ethanol - summary.fuel)}. {summary.fuel === 0 && "Preencha o cenário principal para comparar."}</p>}
      </Section></> : <Section title={`Viagem de ${trip.transport}`} note="Informe o total de passagens de todos os viajantes, já incluindo a volta se houver. Não multiplicamos novamente pelo número de pessoas ou trechos.">{costs(["tickets"])}</Section>}
      <Section title="Outros custos de transporte" note="Valores totais da viagem. Um mesmo custo deve ser informado apenas uma vez.">{costs([...(driving ? ["tickets" as const] : []), "parking", "stopsCost", "rides", "rental", "transportOther"])}</Section>
    </div>

    <div className={tab === 2 ? "space-y-4 print:hidden" : "hidden"}>
      <Section title="Hospedagem">
        {select("lodging", "Tipo de hospedagem", ["hotel", "pousada", "Airbnb", "camping", "casa de familiares", "outro"])}
        {num("nightsOverride", "Noites (ajuste opcional)", 730, "1", `Deixe vazio para usar as datas: ${tripDays({ ...trip, nightsOverride: null }).nights} noite(s).`)}
        {costs(["nightly", "lodgingFees"])}
      </Section>
      <Section title="Alimentação" note="Refeições são valores diários. Mercado é um total separado; não repita valores já incluídos nas refeições.">
        <Field label="Como informar refeições"><select className={inputClass} value={trip.foodMode} onChange={e => update("foodMode", e.target.value as Trip["foodMode"])}><option value="person">Por pessoa / dia (adultos e crianças)</option><option value="group">Para o grupo / dia</option></select></Field><div />{costs(["breakfast", "lunch", "dinner", "snacks", "groceries"])}
      </Section>
      <Section title="Lazer" note="Custos adicionados na aba Roteiro entram automaticamente em Lazer. Não os repita aqui.">{costs(["tours", "admissions", "childActivities", "shopping", "leisureOther"])}</Section>
      <Section title="Extras e imprevistos" note="A reserva fixa e o percentual são adicionais. Use apenas um se representarem o mesmo fundo de emergência.">{costs(["insurance", "internet", "petsCost", "emergency"])}{num("contingency", "Imprevistos sobre o subtotal (%)", 100)}</Section>
      <Section title="Seu orçamento">{num("budget", "Orçamento disponível (R$)")}{num("saved", "Valor já economizado (R$)")}</Section>
      <Section title="Gastos reais durante a viagem" note="Os gastos reais são comparados com o planejado, sem serem somados novamente à estimativa.">
        <Field label="Descrição do gasto"><input className={inputClass} maxLength={180} value={actualTitle} onChange={e => setActualTitle(e.target.value)} /></Field>
        <Field label="Categoria do gasto"><select className={inputClass} value={actualCategory} onChange={e => setActualCategory(e.target.value as ExpenseCategory)}>{expenseCategories.map(c => <option key={c}>{c}</option>)}</select></Field>
        <NumberInput label="Valor realizado (R$)" value={actualAmount} onChange={setActualAmount} />
        <Field label="Data do gasto"><input className={inputClass} type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} /></Field>
        <Button disabled={trip.actual.length >= 500} onClick={() => {
          if (!actualTitle.trim() || !actualAmount || !actualDate) { setMessage("Informe descrição, valor positivo e data do gasto."); return; }
          update("actual", [...trip.actual, { id: crypto.randomUUID(), title: actualTitle.trim(), amount: actualAmount, category: actualCategory, date: actualDate }]); setActualTitle(""); setActualAmount(null); setMessage("Gasto real registrado nesta tela. Salve a viagem para guardar.");
        }}>Adicionar gasto real</Button>
        <ul className="space-y-2 sm:col-span-2">{trip.actual.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"><span>{a.date} · {a.category} · {a.title} · {money(cents(a.amount))}</span><Button variant="ghost" onClick={() => update("actual", trip.actual.filter(x => x.id !== a.id))} aria-label={`Excluir gasto ${a.title}`}>Excluir</Button></li>)}</ul>
      </Section>
    </div>

    <div className={tab === 3 ? "space-y-4 print:hidden" : "hidden"}>
      <Section title={`Sua mala para ${trip.destination || "o destino"}`} note="Sugestões baseadas na duração, viajantes, idades informadas, transporte, atividades e clima manual. Requisitos legais precisam ser confirmados para o destino e a situação; não são uma lista universal de obrigações.">
        <p className="text-sm">{trip.checklist.filter(i => i.done).length} de {trip.checklist.length} itens concluídos.</p>
        <Button variant="secondary" onClick={() => { const existing = new Map(trip.checklist.map(i => [i.id, i])); const suggestions = generateChecklist(trip).filter(i => !existing.has(i.id)); update("checklist", [...trip.checklist, ...suggestions].slice(0, 300)); setMessage("Sugestões adicionadas. Itens editados e marcados foram preservados; revise quantidades se mudou a viagem."); }}>{trip.checklist.length ? "Adicionar sugestões ausentes" : "Gerar checklist da viagem"}</Button>
        <div className="sm:col-span-2 space-y-3">{trip.checklist.map((item, i) => <div key={item.id} className="rounded-lg border border-zinc-200 p-3"><div className="flex items-center gap-2"><input aria-label={`Concluir ${item.text}`} className="h-5 w-5 shrink-0 accent-brand-primary" type="checkbox" checked={item.done} onChange={e => update("checklist", trip.checklist.map(x => x.id === item.id ? { ...x, done: e.target.checked } : x))} /><input aria-label={`Descrição do item ${i + 1}`} className={`${inputClass} ${item.done ? "line-through text-zinc-500" : ""}`} maxLength={180} value={item.text} onChange={e => update("checklist", trip.checklist.map(x => x.id === item.id ? { ...x, text: e.target.value } : x))} /></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><Field label="Grupo"><input className={inputClass} maxLength={60} value={item.group} onChange={e => update("checklist", trip.checklist.map(x => x.id === item.id ? { ...x, group: e.target.value } : x))} /></Field><NumberInput label="Quantidade" step="1" max={10000} value={item.quantity} onChange={v => update("checklist", trip.checklist.map(x => x.id === item.id ? { ...x, quantity: Math.round(v ?? 0) } : x))} /><Field label="Tipo do item"><select className={inputClass} value={item.kind} onChange={e => update("checklist", trip.checklist.map(x => x.id === item.id ? { ...x, kind: e.target.value as typeof item.kind } : x))}>{["Recomendação", "Verificar requisito legal", "Opcional"].map(k => <option key={k}>{k}</option>)}</select></Field></div><div className="mt-2 flex flex-wrap gap-1"><Button variant="ghost" disabled={i === 0} onClick={() => { const list = [...trip.checklist]; [list[i - 1], list[i]] = [list[i], list[i - 1]]; update("checklist", list); }} aria-label={`Subir item ${i + 1}`}>↑ Subir</Button><Button variant="ghost" disabled={i === trip.checklist.length - 1} onClick={() => { const list = [...trip.checklist]; [list[i + 1], list[i]] = [list[i], list[i + 1]]; update("checklist", list); }} aria-label={`Descer item ${i + 1}`}>↓ Descer</Button><Button variant="ghost" onClick={() => update("checklist", trip.checklist.filter(x => x.id !== item.id))} aria-label={`Excluir item ${i + 1}`}>Excluir</Button></div></div>)}</div>
        <Button disabled={trip.checklist.length >= 300} onClick={() => update("checklist", [...trip.checklist, { id: crypto.randomUUID(), group: "Pessoais", text: "Novo item", quantity: 1, kind: "Opcional", done: false }])}>+ Adicionar item pessoal</Button>
      </Section>
    </div>

    <div className={tab === 4 ? "space-y-4 print:hidden" : "hidden"}>
      <Section title="Meu roteiro" note="Monte saídas, descansos, check-in, passeios, refeições e retorno. Altere o dia de uma atividade para movê-la. Cada custo entra em Lazer apenas uma vez; transporte, refeições e hospedagem já orçados devem ter custo zero aqui.">
        <Button disabled={trip.itinerary.length >= 300} onClick={() => update("itinerary", [...trip.itinerary, { id: crypto.randomUUID(), day: 1, time: "", title: "Nova atividade", cost: 0 }])}>+ Adicionar atividade</Button>
        <div className="sm:col-span-2 space-y-4 border-l-2 border-brand-primary/20 pl-4">{[...trip.itinerary].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).map(a => <article key={a.id} className="relative rounded-lg border bg-white p-3"><span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full bg-brand-primary" /><p className="mb-3 text-sm font-semibold text-brand-primary">Dia {a.day} · {a.time || "Horário livre"}{a.day > summary.days && " — fora das datas informadas"}</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Atividade"><input className={inputClass} value={a.title} maxLength={180} onChange={e => update("itinerary", trip.itinerary.map(x => x.id === a.id ? { ...x, title: e.target.value } : x))} /></Field><Field label="Horário"><input className={inputClass} type="time" value={a.time} onChange={e => update("itinerary", trip.itinerary.map(x => x.id === a.id ? { ...x, time: e.target.value } : x))} /></Field><NumberInput label="Dia da atividade" step="1" max={731} value={a.day} onChange={v => update("itinerary", trip.itinerary.map(x => x.id === a.id ? { ...x, day: Math.max(1, Math.round(v ?? 1)) } : x))} /><NumberInput label="Custo adicional do passeio (R$)" value={a.cost} onChange={v => update("itinerary", trip.itinerary.map(x => x.id === a.id ? { ...x, cost: v ?? 0 } : x))} /></div><Button variant="ghost" onClick={() => update("itinerary", trip.itinerary.filter(x => x.id !== a.id))} aria-label={`Excluir atividade ${a.title}`}>Excluir atividade</Button></article>)}</div>
        {trip.route?.signature === routeSignature(trip) && <RouteSketch route={trip.route} />}
      </Section>
    </div>

    <div className={tab === 5 ? "space-y-4" : "hidden print:block"}>
      <Section title="Resumo da viagem">
        <p className="sm:col-span-2 text-sm">{trip.origin || "Origem a definir"} → {trip.destination || "Destino a definir"} · {summary.days} dia(s) · {summary.nights} noite(s) · {summary.people} pessoa(s). {summary.distance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km · {Math.floor(summary.minutes / 60)}h {Math.round(summary.minutes % 60)}min de deslocamento · {trip.checklist.filter(i => !i.done).length} itens pendentes.</p>
        {summary.warnings.length > 0 && <ul className="sm:col-span-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{summary.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        <div className="sm:col-span-2 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Orçamento planejado e realizado por categoria</caption><thead><tr className="border-b"><th className="p-2">Categoria</th><th className="p-2">Planejado</th><th className="p-2">Realizado</th></tr></thead><tbody>{expenseCategories.map(c => <tr key={c} className="border-b"><th className="p-2 font-medium">{c}</th><td className="p-2">{money(summary.categories[c])}</td><td className="p-2">{money(summary.actualCategories[c])}</td></tr>)}<tr><th className="p-2 font-medium">Imprevistos ({trip.contingency}%)</th><td className="p-2">{money(summary.contingency)}</td><td className="p-2">—</td></tr><tr className="bg-brand-primary-soft font-semibold"><th className="p-2">Total</th><td className="p-2">{money(summary.total)}</td><td className="p-2">{money(summary.actual)}</td></tr></tbody></table></div>
        <p className="text-sm">Média por dia: <strong>{money(summary.perDay)}</strong><br />Média por pessoa: <strong>{money(summary.perPerson)}</strong><br />Falta economizar: <strong>{money(summary.remaining)}</strong></p>
        <p className="text-sm">{summary.budgetDifference >= 0 ? "Saldo do orçamento" : "Acima do orçamento"}: <strong>{money(Math.abs(summary.budgetDifference))}</strong><br />Comprometido: <strong>{summary.committed === null ? "Informe seu orçamento" : `${summary.committed.toFixed(1)}%`}</strong><br />Realizado menos planejado: <strong>{money(summary.difference)}</strong></p>
        <div className="flex flex-wrap gap-2 sm:col-span-2 print:hidden"><Button disabled={busy} onClick={exportPdf}>Baixar PDF completo</Button><Button variant="secondary" onClick={() => window.print()}>Imprimir / salvar PDF</Button><Button variant="secondary" onClick={() => setShare(v => !v)}>Preparar resumo para WhatsApp</Button></div>
        {share && <div className="sm:col-span-2 space-y-3 rounded-lg border bg-zinc-50 p-4 print:hidden"><p className="text-sm">Confira o conteúdo antes de abrir o WhatsApp. O resumo contém destinos, datas e valores; só é enviado depois de você escolher o contato e confirmar no WhatsApp.</p><pre className="whitespace-pre-wrap break-words text-xs">{tripSummary(trip)}</pre><a className="inline-flex min-h-11 items-center rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(tripSummary(trip))}`}>Abrir WhatsApp com este resumo</a></div>}
      </Section>
      <div className="hidden space-y-4 print:block"><h3 className="font-semibold">Checklist</h3>{trip.checklist.map(i => <p key={i.id}>{i.done ? "✓" : "□"} {i.group}: {i.text} ({i.quantity}) — {i.kind}</p>)}<h3 className="font-semibold">Meu roteiro</h3>{[...trip.itinerary].sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)).map(a => <p key={a.id}>Dia {a.day}, {a.time}: {a.title} — {money(cents(a.cost))}</p>)}<h3 className="font-semibold">Gastos reais</h3>{trip.actual.map(a => <p key={a.id}>{a.date} · {a.category}: {a.title} — {money(cents(a.amount))}</p>)}</div>
      <div className="print:hidden"><Section title="Como economizar" note="Simulações usando apenas os valores que você informou. Não são ofertas de hotéis, restaurantes ou passagens.">
        <p className="text-sm">Acrescentar uma noite e um dia de refeições: <strong>{money(summary.extraNight)}</strong> antes de imprevistos e outros passeios.</p>
        <p className="text-sm">Dividindo igualmente entre {summary.people} pessoa(s): <strong>{money(summary.perPerson)}</strong> para cada. A divisão não reduz o custo total.</p>
        {num("breakfastUpgrade", "Adicional por diária com café incluído (grupo, R$)")}
        <p className="text-sm">Café separado menos adicional do hotel: <strong>{money(cents((trip.foodMode === "person" ? trip.costs.breakfast * summary.people : trip.costs.breakfast) - trip.breakfastUpgrade))}/dia</strong>. Resultado positivo favorece o café incluído, considerando os valores informados.</p>
        {num("dailyChange", "Redução de gasto diário do grupo (R$)")}
        <p className="text-sm">Impacto dessa redução: <strong>{money(summary.dailyImpact)}</strong> ao longo de {summary.days} dia(s), antes de imprevistos.</p>
        <p className="sm:col-span-2 text-sm">{summary.until ? `Até a saída: aproximadamente ${money(summary.weekly)}/semana ou ${money(summary.monthly)}/mês (períodos de 30 dias).` : "Informe uma saída futura para distribuir a economia por semana ou mês."} Base: valor que falta economizar.</p>
        {trip.scenarios.map((factor, i) => <NumberInput key={i} label={`${["Econômico", "Intermediário", "Confortável"][i]}: percentual dos custos variáveis`} value={factor} max={500} onChange={v => update("scenarios", trip.scenarios.map((n, j) => j === i ? v ?? 0 : n) as Trip["scenarios"])} />)}
        <div className="sm:col-span-2 rounded-lg bg-zinc-50 p-3 text-sm"><p>Premissa: ajustar hospedagem, alimentação e lazer pelo percentual acima; manter transporte e extras. Aplicar os mesmos {trip.contingency}% de imprevistos.</p>{trip.scenarios.map((factor, i) => { const variable = summary.categories.Hospedagem + summary.categories.Alimentação + summary.categories.Lazer; return <p className="mt-2" key={i}><strong>{["Econômico", "Intermediário", "Confortável"][i]}:</strong> {money(Math.round((summary.categories.Transporte + summary.categories.Extras + variable * factor / 100) * (1 + trip.contingency / 100)))}</p>; })}</div>
      </Section></div>
    </div>
    <div className="flex justify-between gap-3 print:hidden"><Button variant="secondary" disabled={tab === 0} onClick={() => setTab(t => t - 1)}>← Voltar</Button><Button disabled={tab === 5} onClick={() => setTab(t => t + 1)}>Próxima etapa →</Button></div>
  </div>;
}
