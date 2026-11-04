/* eslint-disable @next/next/no-img-element */
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TARGET_FIELDS, suggestMapping, type MappingConfig, type TargetField } from "@/lib/imoveis/integracoes/fields";
import { chunkRecords, integrationRequest } from "./api";

export type Source = {
  id: string;
  partner_id: string;
  name: string;
  kind: string;
  format: string;
  feed_mode: string;
  url: string;
  method: string;
  options: Record<string, unknown>;
  frequency_hours: number | null;
  missing_tolerance: number;
  auto_publish: boolean;
  active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string;
  last_error: string;
  has_headers: boolean;
  mapping: (MappingConfig & { id: string; version: number }) | null;
};
export type Partner = { id: string; name: string; trade_name: string; status: string; approved_once: boolean; [k: string]: unknown };

const fmt = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR");

function parseLines(text: string) {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k?.trim() && rest.join("=").trim()) out[k.trim()] = rest.join("=").trim();
  }
  return out;
}
const toLines = (m?: Record<string, string>) => Object.entries(m ?? {}).map(([k, v]) => `${k}=${v}`).join("\n");

export function MappingEditor({
  fields,
  sample,
  initial,
  onSave,
  busy,
}: {
  fields: string[];
  sample?: Record<string, unknown>[];
  initial: MappingConfig;
  onSave: (config: MappingConfig) => void;
  busy?: boolean;
}) {
  const [config, setConfig] = useState<MappingConfig>(initial);
  const [maps, setMaps] = useState({
    typeMap: toLines(initial.transforms.typeMap),
    purposeMap: toLines(initial.transforms.purposeMap),
    featureMap: toLines(initial.transforms.featureMap),
  });
  const used = new Set(Object.values(config.mapping));
  const ignored = fields.filter((f) => !used.has(f));
  const set = (key: TargetField, value: string) =>
    setConfig((c) => ({ ...c, mapping: { ...c.mapping, [key]: value || undefined } }));
  const setDefault = (key: TargetField, value: string) =>
    setConfig((c) => ({ ...c, defaults: { ...c.defaults, [key]: value || undefined } }));
  const preview = (field?: string) => {
    if (!field || !sample?.length) return "";
    const v = sample[0][field];
    return (Array.isArray(v) ? v.join(" | ") : String(v ?? "")).slice(0, 80);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="estate-button secondary" onClick={() => setConfig((c) => ({ ...c, mapping: { ...suggestMapping(fields) } }))}>
          Mapear automaticamente
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Campo Alilu</th>
              <th>Campo do parceiro</th>
              <th>Valor padrão</th>
              <th>Exemplo</th>
            </tr>
          </thead>
          <tbody>
            {TARGET_FIELDS.map((f) => (
              <tr key={f.key} className="border-t border-zinc-100">
                <td className="py-2 pr-3 font-medium">
                  {f.label}
                  {"required" in f && f.required && <span className="text-red-600"> *</span>}
                </td>
                <td className="pr-3">
                  <select aria-label={`Origem de ${f.label}`} value={config.mapping[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">— não mapear —</option>
                    {fields.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-3">
                  <input aria-label={`Padrão de ${f.label}`} value={config.defaults[f.key] ?? ""} onChange={(e) => setDefault(f.key, e.target.value)} />
                </td>
                <td className="max-w-[220px] truncate text-xs text-zinc-500">{preview(config.mapping[f.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label>
          Separador de fotos (vazio = automático)
          <input value={config.transforms.photoDelimiter ?? ""} onChange={(e) => setConfig((c) => ({ ...c, transforms: { ...c.transforms, photoDelimiter: e.target.value } }))} />
        </label>
        <label>
          Unidade de área
          <select value={config.transforms.areaUnit ?? "m2"} onChange={(e) => setConfig((c) => ({ ...c, transforms: { ...c.transforms, areaUnit: e.target.value as "m2" | "ha" } }))}>
            <option value="m2">m²</option>
            <option value="ha">hectares</option>
          </select>
        </label>
        <label>
          Valores monetários
          <select value={String(config.transforms.priceDivisor ?? 1)} onChange={(e) => setConfig((c) => ({ ...c, transforms: { ...c.transforms, priceDivisor: Number(e.target.value) } }))}>
            <option value="1">em reais</option>
            <option value="100">em centavos</option>
          </select>
        </label>
        {(["typeMap", "purposeMap", "featureMap"] as const).map((k) => (
          <label key={k}>
            {k === "typeMap" ? "Conversão de tipos" : k === "purposeMap" ? "Conversão de finalidade" : "Conversão de características"} (Origem=Alilu, um por linha)
            <textarea rows={4} value={maps[k]} onChange={(e) => setMaps((m) => ({ ...m, [k]: e.target.value }))} placeholder={k === "typeMap" ? "Sobrado=Casa" : k === "purposeMap" ? "Locação=Aluguel" : "Pool=Piscina"} />
          </label>
        ))}
      </div>
      {ignored.length > 0 && (
        <p className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
          Campos do parceiro não utilizados (registrados para diagnóstico): {ignored.slice(0, 40).join(", ")}
          {ignored.length > 40 ? ` e mais ${ignored.length - 40}` : ""}
        </p>
      )}
      <button
        type="button"
        className="estate-button"
        disabled={busy || !config.mapping.code}
        onClick={() =>
          onSave({
            ...config,
            transforms: { ...config.transforms, typeMap: parseLines(maps.typeMap), purposeMap: parseLines(maps.purposeMap), featureMap: parseLines(maps.featureMap) },
          })
        }
      >
        Salvar mapeamento
      </button>
    </div>
  );
}

type BatchDetail = {
  batch: Record<string, unknown> & { id: string; status: string; summary: Record<string, unknown>; fields: string[]; source_id: string; mapping_id: string | null };
  items: Record<string, unknown>[];
  progress: { staged: number; pending_import: number; imported: number; failed: number };
};

export function BatchView({ batchId, source, onChanged }: { batchId: string; source?: Source; onChanged?: () => void }) {
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [publish, setPublish] = useState(true);
  const [editMapping, setEditMapping] = useState(false);
  const load = useCallback(async () => {
    setDetail(await integrationRequest<BatchDetail>(`/lotes/${batchId}?filter=${filter}`));
  }, [batchId, filter]);
  useEffect(() => {
    integrationRequest<BatchDetail>(`/lotes/${batchId}?filter=${filter}`)
      .then(setDetail)
      .catch((e) => setMessage((e as Error).message));
  }, [batchId, filter]);
  const loop = async (path: string, first?: unknown) => {
    setBusy(true);
    setMessage("");
    try {
      let body = first ?? {};
      for (let i = 0; i < 500; i++) {
        const r = await integrationRequest<{ done?: boolean; busy?: boolean; remaining?: number }>(path, "POST", body);
        body = {};
        await load();
        if (r.done) break;
        if (r.busy) await new Promise((res) => setTimeout(res, 2000));
      }
      onChanged?.();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!detail) return <p className="text-sm text-zinc-500">{message || "Carregando lote..."}</p>;
  const b = detail.batch,
    s = b.summary ?? {};
  const counts: [string, unknown][] = [
    ["Registros", b.total],
    ["Válidos", b.valid],
    ["Inválidos", b.invalid],
    ["Novos", s.new],
    ["A atualizar", s.update],
    ["Sem alteração", s.unchanged],
    ["Indisponíveis no feed", s.remove],
    ["Repetidos no arquivo", s.duplicate_in_file],
    ["Sem fotos", s.no_photos],
    ["Sem preço", s.no_price],
    ["Sem link original", s.no_link],
    ["Erros de conversão", s.conversion_errors],
    ["Ficarão pendentes", s.blocked],
  ];
  const done: [string, unknown][] = [
    ["Criados", b.created],
    ["Atualizados", b.updated],
    ["Inalterados", b.unchanged],
    ["Ignorados", b.skipped],
    ["Possíveis duplicidades", b.duplicates],
    ["Arquivados por ausência", b.archived],
    ["Falhas", detail.progress.failed],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            {String(b.partner_name)} · {String(b.source_name)} · {String(b.file_name || b.origin)}
          </p>
          <p className="font-semibold">Situação: {b.status}</p>
          {String(b.error ?? "") !== "" && <p className="text-sm text-red-700">{String(b.error)}</p>}
        </div>
        <a className="estate-button secondary" href={`/api/imoveis/integracoes/lotes/${b.id}/erros.csv`}>
          Baixar relatório de erros
        </a>
      </div>
      {((b.status === "staged" && !b.mapping_id) || (editMapping && ["staged", "validated"].includes(b.status))) && source && (
        <div className="estate-panel">
          <h3 className="mb-3 font-semibold">Mapeamento de campos</h3>
          <MappingEditor
            fields={b.fields}
            initial={source.mapping ?? { mapping: suggestMapping(b.fields), defaults: {}, transforms: {} }}
            busy={busy}
            onSave={async (config) => {
              setBusy(true);
              try {
                const m = await integrationRequest<{ id: string }>(`/fontes/${source.id}/mapeamento`, "POST", config);
                setBusy(false);
                setEditMapping(false);
                await loop(`/lotes/${b.id}/validar`, { mappingId: m.id });
              } catch (e) {
                setMessage((e as Error).message);
                setBusy(false);
              }
            }}
          />
        </div>
      )}
      {b.status === "staged" && b.mapping_id && (
        <button type="button" className="estate-button" disabled={busy} onClick={() => loop(`/lotes/${b.id}/validar`)}>
          Continuar validação ({fmt(detail.progress.staged)} restantes)
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {(["validated", "staged"].includes(b.status) ? counts : [...done, ...counts.slice(0, 3)]).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-zinc-50 p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-xl font-bold text-brand-primary">{fmt(value)}</p>
          </div>
        ))}
      </div>
      {Array.isArray(s.ignoredFields) && (s.ignoredFields as string[]).length > 0 && (
        <p className="text-xs text-zinc-500">Campos ignorados: {(s.ignoredFields as string[]).slice(0, 30).join(", ")}</p>
      )}
      {Array.isArray(s.notes) && (s.notes as string[]).map((n) => (
        <p key={n} className="rounded-xl bg-brand-accent-soft p-3 text-sm">
          {n}
        </p>
      ))}
      {b.status === "validated" && (
        <div className="estate-panel space-y-3">
          <p className="text-sm">
            Esta validação é uma <strong>simulação</strong>: nenhum anúncio foi gravado ainda. Itens inválidos nunca são publicados; itens sem fotos,
            sem destino de contato ou de parceiro sem CRECI ficam pendentes de moderação.
          </p>
          <label>
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publicar imediatamente os imóveis válidos (aprovação administrativa deste lote)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="estate-button"
              disabled={busy || !Number(b.valid)}
              onClick={async () => {
                if (!window.confirm(`Confirmar a importação de ${fmt(b.valid)} imóveis válidos?`)) return;
                setBusy(true);
                try {
                  await integrationRequest(`/lotes/${b.id}/importar`, "POST", { publish });
                  setBusy(false);
                  await loop(`/lotes/${b.id}/processar`);
                } catch (e) {
                  setMessage((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              Confirmar importação
            </button>
            {source && (
              <button type="button" className="estate-button secondary" disabled={busy} onClick={() => setEditMapping(true)}>
                Alterar mapeamento e revalidar
              </button>
            )}
            <button
              type="button"
              className="estate-button secondary"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm("Cancelar este lote? Nenhum anúncio será alterado.")) return;
                await integrationRequest(`/lotes/${b.id}/cancelar`, "POST", {}).catch((e) => setMessage((e as Error).message));
                await load();
                onChanged?.();
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {b.status === "importing" && (
        <button type="button" className="estate-button" disabled={busy} onClick={() => loop(`/lotes/${b.id}/processar`)}>
          {busy ? "Importando..." : `Continuar importação (${fmt(detail.progress.pending_import)} restantes)`}
        </button>
      )}
      {["completed", "failed"].includes(b.status) && detail.progress.failed > 0 && (
        <button
          type="button"
          className="estate-button secondary"
          disabled={busy}
          onClick={async () => {
            await integrationRequest(`/lotes/${b.id}/reprocessar`, "POST", {}).catch((e) => setMessage((e as Error).message));
            await loop(`/lotes/${b.id}/processar`);
          }}
        >
          Reprocessar falhas
        </button>
      )}
      {message && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        {[["", "Todos"], ["new", "Novos"], ["update", "Atualizar"], ["invalid", "Inválidos"], ["blocked", "Pendentes"], ["warnings", "Com avisos"], ["failed", "Falhas"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 ${filter === k ? "border-brand-primary bg-brand-primary text-white" : "border-zinc-200"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Linha</th>
              <th>Código</th>
              <th>Imóvel</th>
              <th>Preço</th>
              <th>Fotos</th>
              <th>Ação</th>
              <th>Erros / avisos</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((i) => (
              <tr key={String(i.id)} className="border-t border-zinc-100 align-top">
                <td className="py-2">{String(i.row_number)}</td>
                <td>{String(i.external_code)}</td>
                <td className="max-w-[260px]">
                  <div className="flex gap-2">
                    {typeof i.cover === "string" && <img src={i.cover} alt="" width={48} height={36} loading="lazy" referrerPolicy="no-referrer" className="h-9 w-12 rounded object-cover" />}
                    <span>
                      {String(i.title ?? "—")}
                      <br />
                      <span className="text-xs text-zinc-500">
                        {String(i.type ?? "")} · {String(i.purpose ?? "")} · {String(i.neighborhood ?? "")}, {String(i.city ?? "")}
                      </span>
                    </span>
                  </div>
                </td>
                <td>{i.price ? Number(i.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
                <td>{String(i.photos ?? 0)}</td>
                <td>
                  {String(i.action)}
                  {i.result ? ` → ${String(i.result)}` : ""}
                </td>
                <td className="max-w-[320px] text-xs">
                  {(i.errors as string[]).map((e) => (
                    <p key={e} className="text-red-700">
                      {e}
                    </p>
                  ))}
                  {((i.blockers as string[] | null) ?? []).map((e) => (
                    <p key={e} className="text-amber-700">
                      Pendente: {e}
                    </p>
                  ))}
                  {(i.warnings as string[]).map((e) => (
                    <p key={e} className="text-zinc-500">
                      {e}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Parsed = { records: Record<string, string | string[]>[]; fields: string[]; sheets?: string[]; warnings: string[] };

export function ImportWizard({ partners, sources, onChanged }: { partners: Partner[]; sources: Source[]; onChanged: () => void }) {
  const [partnerId, setPartnerId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("");
  const [options, setOptions] = useState({ delimiter: "", sheet: "", collectionPath: "", recordTag: "" });
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [complete, setComplete] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const partnerSources = useMemo(() => sources.filter((s) => s.partner_id === partnerId), [sources, partnerId]);
  const source = sources.find((s) => s.id === sourceId);

  async function read(f: File, opts = options) {
    setBusy(true);
    setMessage("");
    try {
      if (f.size > 30 * 1024 * 1024) throw new Error("Arquivo acima de 30 MB. Divida-o em partes.");
      const { parseFile, detectFormat } = await import("@/lib/imoveis/integracoes/parsers");
      const bytes = new Uint8Array(await f.arrayBuffer());
      const detected = detectFormat(f.name, bytes);
      setFormat(detected);
      const result = await parseFile(bytes, detected === "vrsync" ? "xml" : detected, {
        delimiter: opts.delimiter || undefined,
        sheet: opts.sheet || undefined,
        collectionPath: opts.collectionPath || undefined,
        recordTag: opts.recordTag || (detected === "vrsync" ? "Listing" : undefined),
      });
      setParsed(result);
    } catch (e) {
      setParsed(null);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!parsed || !source) return;
    setBusy(true);
    setMessage("");
    try {
      const { id } = await integrationRequest<{ id: string }>("/lotes", "POST", { sourceId: source.id, fileName: file?.name ?? "", completeFeed: complete });
      const codeField = source.mapping?.mapping.code ?? suggestMapping(parsed.fields).code;
      for (const chunk of chunkRecords(parsed.records)) await integrationRequest(`/lotes/${id}/registros`, "POST", { records: chunk, codeField });
      await integrationRequest(`/lotes/${id}/fechar`, "POST", { fields: parsed.fields });
      setBatchId(id);
      onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (batchId && source)
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm text-brand-primary" onClick={() => { setBatchId(""); setParsed(null); setFile(null); }}>
          ← Nova importação
        </button>
        <SourceMappingThenBatch batchId={batchId} source={source} onChanged={onChanged} />
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-600">Validar → Mapear → Visualizar → Importar. O arquivo é lido no seu navegador e enviado em partes; nada é publicado sem a sua confirmação.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label>
          Parceiro
          <select value={partnerId} onChange={(e) => { setPartnerId(e.target.value); setSourceId(""); }}>
            <option value="">Selecione</option>
            {partners.filter((p) => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>
                {p.trade_name || p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fonte
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={!partnerId}>
            <option value="">Selecione</option>
            {partnerSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.kind}){s.mapping ? ` · mapeamento v${s.mapping.version}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          Arquivo (XML / VRSync, JSON, Excel .xlsx ou CSV — até 30 MB)
          <input
            type="file"
            accept=".xml,.json,.xlsx,.csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) read(f);
            }}
          />
        </label>
      </div>
      {file && (
        <div className="grid gap-4 md:grid-cols-4">
          {format === "csv" && (
            <label>
              Separador CSV
              <select value={options.delimiter} onChange={(e) => { const o = { ...options, delimiter: e.target.value }; setOptions(o); read(file, o); }}>
                <option value="">Automático</option>
                <option value=";">Ponto e vírgula (;)</option>
                <option value=",">Vírgula (,)</option>
                <option value={"\t"}>Tabulação</option>
                <option value="|">Barra (|)</option>
              </select>
            </label>
          )}
          {format === "xlsx" && parsed?.sheets && (
            <label>
              Aba
              <select value={options.sheet} onChange={(e) => { const o = { ...options, sheet: e.target.value }; setOptions(o); read(file, o); }}>
                {parsed.sheets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          {format === "json" && (
            <label>
              Caminho da coleção (ex.: dados.imoveis)
              <input value={options.collectionPath} onChange={(e) => setOptions({ ...options, collectionPath: e.target.value })} onBlur={() => read(file)} />
            </label>
          )}
          {(format === "xml" || format === "vrsync") && (
            <label>
              Elemento de cada imóvel
              <input value={options.recordTag} placeholder={format === "vrsync" ? "Listing" : "automático"} onChange={(e) => setOptions({ ...options, recordTag: e.target.value })} onBlur={() => read(file)} />
            </label>
          )}
          <p className="self-end text-sm text-zinc-500">Formato detectado: {format.toUpperCase()}</p>
        </div>
      )}
      {parsed && (
        <div className="estate-panel space-y-3">
          <p className="font-semibold">
            {fmt(parsed.records.length)} registros · {parsed.fields.length} campos
          </p>
          {parsed.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-700">
              {w}
            </p>
          ))}
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  {parsed.fields.slice(0, 12).map((f) => (
                    <th key={f} className="px-2 py-1 text-left text-zinc-500">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.records.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    {parsed.fields.slice(0, 12).map((f) => (
                      <td key={f} className="max-w-[160px] truncate px-2 py-1">
                        {Array.isArray(r[f]) ? (r[f] as string[]).join(" | ") : String(r[f] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
            Este arquivo é a carteira completa do parceiro (imóveis ausentes poderão ser pausados após a tolerância configurada)
          </label>
          <button type="button" className="estate-button" disabled={busy || !source} onClick={send}>
            {busy ? "Enviando..." : "Enviar para validação"}
          </button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}

/** Após o envio: se a fonte já tem mapeamento, valida direto; senão, mostra o editor. */
function SourceMappingThenBatch({ batchId, source, onChanged }: { batchId: string; source: Source; onChanged: () => void }) {
  const [ready, setReady] = useState(!source.mapping);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!source.mapping) return;
    (async () => {
      try {
        for (let i = 0; i < 500; i++) {
          const r = await integrationRequest<{ done?: boolean }>(`/lotes/${batchId}/validar`, "POST", i === 0 ? { mappingId: source.mapping!.id } : {});
          if (r.done) break;
        }
      } catch (e) {
        setError((e as Error).message);
      }
      setReady(true);
    })();
  }, [batchId, source.mapping]);
  if (!ready) return <p className="text-sm text-zinc-500">Validando com o mapeamento v{source.mapping?.version}...</p>;
  return (
    <>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <BatchView batchId={batchId} source={source} onChanged={onChanged} />
    </>
  );
}
