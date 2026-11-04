"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { STATES, STATUS } from "@/lib/imoveis/model";
import { integrationRequest } from "./api";
import { BatchView, ImportWizard, type Partner, type Source } from "./ImportFlow";

type Dashboard = {
  counts: Record<string, number | string | null>;
  perPartner: { name: string; published: number; pending: number; total: number }[];
};
type Data = { dashboard: Dashboard; partners: Partner[]; sources: Source[]; batches: Record<string, unknown>[] };

const TABS = [
  ["painel", "Painel"],
  ["parceiros", "Parceiros"],
  ["fontes", "Fontes de importação"],
  ["importar", "Importar arquivo"],
  ["lotes", "Prévias e sincronizações"],
  ["importados", "Imóveis importados"],
  ["duplicidades", "Duplicidades"],
  ["logs", "Logs e erros"],
  ["config", "Configurações"],
] as const;

const fmt = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR");
const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString("pt-BR") : "—");

export function IntegrationsPanel({ initial }: { initial: Data }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("painel");
  const [data, setData] = useState(initial);
  const [openBatch, setOpenBatch] = useState("");
  const refresh = useCallback(async () => setData(await integrationRequest<Data>("/painel")), []);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/imoveis" className="text-sm text-brand-primary">
          ← Anúncios e moderação
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Integração de imóveis</h1>
        <p className="text-zinc-500">Imóveis de imobiliárias e corretores parceiros autorizados. Anúncios diretos não são alterados por esta área.</p>
      </div>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Seções da integração">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setTab(k); setOpenBatch(""); }}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${tab === k ? "border-brand-primary bg-brand-primary text-white" : "border-zinc-200 bg-white"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className="estate-panel">
        {tab === "painel" && <DashboardView data={data} />}
        {tab === "parceiros" && <PartnersView partners={data.partners} onChanged={refresh} />}
        {tab === "fontes" && <SourcesView partners={data.partners} sources={data.sources} onChanged={refresh} />}
        {tab === "importar" && <ImportWizard partners={data.partners} sources={data.sources} onChanged={refresh} />}
        {tab === "lotes" &&
          (openBatch ? (
            <div className="space-y-4">
              <button type="button" className="text-sm text-brand-primary" onClick={() => setOpenBatch("")}>
                ← Todos os lotes
              </button>
              <BatchView
                batchId={openBatch}
                source={data.sources.find((s) => s.id === data.batches.find((b) => b.id === openBatch)?.source_id) ?? undefined}
                onChanged={refresh}
              />
            </div>
          ) : (
            <BatchesView batches={data.batches} onOpen={setOpenBatch} onRefresh={refresh} />
          ))}
        {tab === "importados" && <ImportedView partners={data.partners} />}
        {tab === "duplicidades" && <DuplicatesView />}
        {tab === "logs" && <LogsView partners={data.partners} />}
        {tab === "config" && <ConfigView />}
      </section>
    </div>
  );
}

function DashboardView({ data }: { data: Data }) {
  const c = data.dashboard.counts;
  const cards: [string, unknown][] = [
    ["Parceiros", c.partners],
    ["Parceiros ativos", c.active_partners],
    ["Imóveis importados", c.imported],
    ["Publicados", c.published],
    ["Pendentes", c.pending],
    ["Erros (7 dias)", c.errors],
    ["Possíveis duplicidades", c.duplicates],
    ["Cliques no anúncio original", c.clicks],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-brand-primary-soft p-4">
            <p className="text-xs text-zinc-600">{label}</p>
            <p className="text-2xl font-bold text-brand-primary">{fmt(value)}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-zinc-600">
        Última sincronização: {when(c.last_sync)} · Próxima sincronização: {when(c.next_sync)}
      </p>
      <div>
        <h2 className="mb-2 font-semibold">Anúncios por parceiro</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1">Parceiro</th>
              <th>Publicados</th>
              <th>Pendentes</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.dashboard.perPartner.map((p) => (
              <tr key={p.name} className="border-t border-zinc-100">
                <td className="py-1">{p.name}</td>
                <td>{fmt(p.published)}</td>
                <td>{fmt(p.pending)}</td>
                <td>{fmt(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">Histórico recente</h2>
        <ul className="space-y-1 text-sm">
          {data.batches.slice(0, 8).map((b) => (
            <li key={String(b.id)}>
              {String(b.partner_name)} — {String(b.origin)} — {String(b.status)} — {fmt(b.created)} criados, {fmt(b.updated)} atualizados, {fmt(b.invalid)} inválidos ({when(b.created_at)})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const EMPTY_PARTNER = {
  name: "", tradeName: "", legalName: "", partnerType: "Imobiliária", document: "", creci: "", phone: "", whatsapp: "", email: "", website: "", logoUrl: "",
  city: "São José dos Campos", state: "SP", contactPerson: "", contactPhone: "", allowedImageHosts: "", imagePolicy: "external", allowListingContacts: false,
  seoPolicy: "noindex", maxListings: 2000,
  authorization: { authorizedBy: "", authorizedAt: "", scope: "", imagesMayBeCopied: false, descriptionsAllowed: true, linksAllowed: true, validUntil: "", conditions: "", removalPolicy: "" },
};
type PartnerForm = typeof EMPTY_PARTNER;

function toForm(p: Partner): PartnerForm {
  const auth = (p.authorization_data ?? {}) as Partial<PartnerForm["authorization"]>;
  return {
    ...EMPTY_PARTNER,
    name: p.name, tradeName: p.trade_name, partnerType: String(p.partner_type), creci: String(p.creci), phone: String(p.phone), whatsapp: String(p.whatsapp).replace(/^55/, ""),
    email: String(p.email), website: String(p.website), logoUrl: String(p.logo_url), city: String(p.city), state: String(p.state), contactPerson: String(p.contact_person),
    allowedImageHosts: (p.allowed_image_hosts as string[]).join(", "), imagePolicy: String(p.image_policy), allowListingContacts: p.allow_listing_contacts === true,
    seoPolicy: String(p.seo_policy), maxListings: Number(p.max_listings),
    authorization: { ...EMPTY_PARTNER.authorization, ...auth },
  };
}

function PartnersView({ partners, onChanged }: { partners: Partner[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_PARTNER);
  const [message, setMessage] = useState("");
  const set = (k: keyof PartnerForm, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const setAuth = (k: keyof PartnerForm["authorization"], v: unknown) => setForm((f) => ({ ...f, authorization: { ...f.authorization, [k]: v } }));
  async function save() {
    setMessage("");
    try {
      if (editing === "new") await integrationRequest("/parceiros", "POST", form);
      else await integrationRequest(`/parceiros/${editing}`, "PATCH", form);
      setEditing(null);
      await onChanged();
      setMessage("Parceiro salvo.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function status(p: Partner, next: string) {
    const reason = next === "active" ? "" : window.prompt(`Motivo para ${next === "suspended" ? "suspender" : "inativar"} ${p.name}:`) ?? "";
    if (next !== "active" && !reason) return;
    await integrationRequest(`/parceiros/${p.id}/status`, "POST", { status: next, reason }).catch((e) => setMessage((e as Error).message));
    await onChanged();
  }
  const text = (k: keyof PartnerForm, label: string, extra: Record<string, unknown> = {}) => (
    <label>
      {label}
      <input value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)} {...extra} />
    </label>
  );
  if (editing)
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold">{editing === "new" ? "Novo parceiro" : "Editar parceiro"}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {text("name", "Nome da imobiliária ou corretor *")}
          {text("tradeName", "Nome fantasia")}
          {text("legalName", "Razão social")}
          <label>
            Tipo
            <select value={form.partnerType} onChange={(e) => set("partnerType", e.target.value)}>
              <option>Imobiliária</option>
              <option>Corretor</option>
            </select>
          </label>
          {text("document", editing === "new" ? "CNPJ/CPF profissional (cifrado; opcional)" : "CNPJ/CPF (preencha para substituir)")}
          {text("creci", "CRECI (ex.: SP 123456-J)")}
          {text("phone", "Telefone comercial")}
          {text("whatsapp", "WhatsApp comercial autorizado")}
          {text("email", "E-mail comercial")}
          {text("website", "Site")}
          {text("logoUrl", "URL do logo (https)")}
          {text("contactPerson", "Pessoa responsável")}
          {text("contactPhone", "Telefone do responsável (privado)")}
          {text("city", "Cidade")}
          <label>
            UF
            <select value={form.state} onChange={(e) => set("state", e.target.value)}>
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {text("allowedImageHosts", "Domínios autorizados das fotos (separados por vírgula)")}
          <label>
            Fotos
            <select value={form.imagePolicy} onChange={(e) => set("imagePolicy", e.target.value)}>
              <option value="external">Exibir do servidor do parceiro</option>
              <option value="copy">Copiar para o Alilu (exige autorização)</option>
            </select>
          </label>
          <label>
            Indexação no Google
            <select value={form.seoPolicy} onChange={(e) => set("seoPolicy", e.target.value)}>
              <option value="noindex">Não indexar (padrão — conteúdo existe no site original)</option>
              <option value="index">Indexar (conteúdo exclusivo/autorizado)</option>
            </select>
          </label>
          {text("maxListings", "Limite de anúncios", { type: "number", min: 1, max: 50000 })}
          <label className="self-end">
            <input type="checkbox" checked={form.allowListingContacts} onChange={(e) => set("allowListingContacts", e.target.checked)} />
            Aceitar WhatsApp por anúncio vindo do arquivo
          </label>
        </div>
        <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4">
          <legend className="px-2 font-semibold">Autorização de publicação</legend>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              Quem autorizou *
              <input value={form.authorization.authorizedBy} onChange={(e) => setAuth("authorizedBy", e.target.value)} />
            </label>
            <label>
              Data da autorização *
              <input type="date" value={form.authorization.authorizedAt} onChange={(e) => setAuth("authorizedAt", e.target.value)} />
            </label>
            <label>
              Válida até
              <input type="date" value={form.authorization.validUntil} onChange={(e) => setAuth("validUntil", e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label>
              <input type="checkbox" checked={form.authorization.descriptionsAllowed} onChange={(e) => setAuth("descriptionsAllowed", e.target.checked)} />
              Pode reutilizar descrições
            </label>
            <label>
              <input type="checkbox" checked={form.authorization.linksAllowed} onChange={(e) => setAuth("linksAllowed", e.target.checked)} />
              Pode exibir link do anúncio original
            </label>
            <label>
              <input type="checkbox" checked={form.authorization.imagesMayBeCopied} onChange={(e) => setAuth("imagesMayBeCopied", e.target.checked)} />
              Pode copiar fotos para o Alilu
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(["scope", "conditions", "removalPolicy"] as const).map((k) => (
              <label key={k}>
                {k === "scope" ? "Escopo da autorização" : k === "conditions" ? "Condições de uso de imagens e descrições" : "Política de remoção e atualização"}
                <textarea rows={3} value={form.authorization[k]} onChange={(e) => setAuth(k, e.target.value)} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button type="button" className="estate-button" onClick={save}>
            Salvar parceiro
          </button>
          <button type="button" className="estate-button secondary" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </div>
        {message && <p role="alert" className="text-sm font-semibold text-red-700">{message}</p>}
      </div>
    );
  return (
    <div className="space-y-4">
      <button type="button" className="estate-button" onClick={() => { setForm(EMPTY_PARTNER); setEditing("new"); }}>
        Cadastrar parceiro
      </button>
      {message && <p className="text-sm">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Parceiro</th>
              <th>CRECI</th>
              <th>Status</th>
              <th>Anúncios</th>
              <th>Autorização</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const auth = (p.authorization_data ?? {}) as Record<string, string>;
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="py-2">
                    <strong>{p.trade_name || p.name}</strong>
                    <br />
                    <span className="text-xs text-zinc-500">{String(p.city)} / {String(p.state)}</span>
                  </td>
                  <td>{String(p.creci) || "—"}</td>
                  <td>{p.status}{p.approved_once ? "" : " · aguardando 1ª aprovação"}</td>
                  <td>{fmt(p.published)} publicados / {fmt(p.listings)}</td>
                  <td className="text-xs">{auth.authorizedBy} em {auth.authorizedAt}{auth.validUntil ? ` (até ${auth.validUntil})` : ""}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button type="button" className="text-brand-primary underline" onClick={() => { setForm(toForm(p)); setEditing(p.id); }}>Editar</button>
                    {p.status === "active" ? (
                      <>
                        <button type="button" className="text-red-700 underline" onClick={() => status(p, "suspended")}>Suspender</button>
                        <button type="button" className="text-zinc-600 underline" onClick={() => status(p, "inactive")}>Inativar</button>
                      </>
                    ) : (
                      <button type="button" className="text-brand-primary underline" onClick={() => status(p, "active")}>Reativar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Suspender ou inativar oculta imediatamente todos os anúncios do parceiro (busca, página, contato e sitemap) sem apagar dados.</p>
    </div>
  );
}

const EMPTY_SOURCE = {
  partnerId: "", name: "", kind: "url", format: "vrsync", feedMode: "full", url: "", method: "GET", headers: "", frequencyHours: "24", missingTolerance: 2,
  autoPublish: false, active: true, options: { collectionPath: "", recordTag: "", delimiter: "", sheet: "", body: "", allowLargeShrink: false, pagination: { type: "none", param: "page", start: 1, maxPages: 20, cursorPath: "", cursorParam: "cursor" } },
};

function SourcesView({ partners, sources, onChanged }: { partners: Partner[]; sources: Source[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_SOURCE);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const partnerName = (id: string) => partners.find((p) => p.id === id)?.name ?? "";
  async function save() {
    setMessage("");
    try {
      let headers: unknown = undefined;
      if (form.headers.trim()) {
        try {
          headers = JSON.parse(form.headers);
        } catch {
          throw new Error('Headers devem ser JSON, ex.: {"Authorization":"Bearer ..."}');
        }
      }
      const payload = { ...form, headers, frequencyHours: form.frequencyHours === "" ? null : Number(form.frequencyHours) };
      if (editing === "new") await integrationRequest("/fontes", "POST", payload);
      else await integrationRequest(`/fontes/${editing}`, "PATCH", payload);
      setEditing(null);
      await onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function sync(s: Source) {
    setBusy(s.id);
    setMessage("");
    try {
      const r = await integrationRequest<{ error?: string; needsMapping?: boolean; done?: boolean }>(`/fontes/${s.id}/sincronizar`, "POST", {});
      setMessage(r.error ? `Falha: ${r.error}` : r.needsMapping ? "Feed lido. Abra o lote em 'Prévias e sincronizações' para mapear os campos." : r.done ? "Sincronização concluída." : "Sincronização em andamento; a rotina agendada continuará.");
      await onChanged();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (editing)
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{editing === "new" ? "Nova fonte" : "Editar fonte"}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label>
            Parceiro
            <select value={form.partnerId} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
              <option value="">Selecione</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            Nome
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value, frequencyHours: e.target.value === "upload" ? "" : form.frequencyHours })}>
              <option value="upload">Upload manual</option>
              <option value="url">Feed por URL</option>
              <option value="api">API do parceiro</option>
            </select>
          </label>
          <label>
            Formato
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="vrsync">XML VRSync</option>
              <option value="xml">XML personalizado</option>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </label>
          <label>
            Tipo de feed
            <select value={form.feedMode} onChange={(e) => setForm({ ...form, feedMode: e.target.value })}>
              <option value="full">Completo (carteira inteira)</option>
              <option value="incremental">Incremental (somente alterações)</option>
            </select>
          </label>
          {form.kind !== "upload" && (
            <>
              <label className="md:col-span-2">
                URL autorizada (https)
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </label>
              <label>
                Método
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option>GET</option>
                  <option>POST</option>
                </select>
              </label>
              <label className="md:col-span-2">
                Headers / token (JSON; armazenado cifrado, nunca exibido)
                <input value={form.headers} placeholder={editing !== "new" && sources.find((s) => s.id === editing)?.has_headers ? "•••• configurado — preencha para substituir" : '{"Authorization":"Bearer ..."}'} onChange={(e) => setForm({ ...form, headers: e.target.value })} />
              </label>
              <label>
                Frequência
                <select value={form.frequencyHours} onChange={(e) => setForm({ ...form, frequencyHours: e.target.value })}>
                  <option value="">Manual</option>
                  <option value="6">A cada 6 horas</option>
                  <option value="12">A cada 12 horas</option>
                  <option value="24">Diária</option>
                  <option value="168">Semanal</option>
                </select>
              </label>
              <label>
                Paginação
                <select value={form.options.pagination.type} onChange={(e) => setForm({ ...form, options: { ...form.options, pagination: { ...form.options.pagination, type: e.target.value } } })}>
                  <option value="none">Sem paginação</option>
                  <option value="page">Por número de página</option>
                  <option value="cursor">Por cursor (JSON)</option>
                </select>
              </label>
              {form.options.pagination.type === "page" && (
                <label>
                  Parâmetro da página / máximo de páginas
                  <div className="flex gap-2">
                    <input value={form.options.pagination.param} onChange={(e) => setForm({ ...form, options: { ...form.options, pagination: { ...form.options.pagination, param: e.target.value } } })} />
                    <input type="number" min={1} max={200} value={form.options.pagination.maxPages} onChange={(e) => setForm({ ...form, options: { ...form.options, pagination: { ...form.options.pagination, maxPages: Number(e.target.value) } } })} />
                  </div>
                </label>
              )}
              {form.options.pagination.type === "cursor" && (
                <label>
                  Caminho do próximo cursor / parâmetro
                  <div className="flex gap-2">
                    <input placeholder="meta.next" value={form.options.pagination.cursorPath} onChange={(e) => setForm({ ...form, options: { ...form.options, pagination: { ...form.options.pagination, cursorPath: e.target.value } } })} />
                    <input value={form.options.pagination.cursorParam} onChange={(e) => setForm({ ...form, options: { ...form.options, pagination: { ...form.options.pagination, cursorParam: e.target.value } } })} />
                  </div>
                </label>
              )}
            </>
          )}
          <label>
            Caminho da coleção JSON / elemento XML
            <input value={form.format === "json" ? form.options.collectionPath : form.options.recordTag} placeholder={form.format === "json" ? "imoveis" : "Listing"} onChange={(e) => setForm({ ...form, options: form.format === "json" ? { ...form.options, collectionPath: e.target.value } : { ...form.options, recordTag: e.target.value } })} />
          </label>
          <label>
            Tolerância de ausências antes de pausar
            <input type="number" min={1} max={30} value={form.missingTolerance} onChange={(e) => setForm({ ...form, missingTolerance: Number(e.target.value) })} />
          </label>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label>
            <input type="checkbox" checked={form.autoPublish} onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })} />
            Publicar automaticamente novos imóveis válidos (somente após a 1ª aprovação do parceiro)
          </label>
          <label>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Fonte ativa
          </label>
          <label>
            <input type="checkbox" checked={form.options.allowLargeShrink} onChange={(e) => setForm({ ...form, options: { ...form.options, allowLargeShrink: e.target.checked } })} />
            Permitir quedas acima de 50% no feed completo
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" className="estate-button" onClick={save}>Salvar fonte</button>
          <button type="button" className="estate-button secondary" onClick={() => setEditing(null)}>Cancelar</button>
        </div>
        {message && <p role="alert" className="text-sm font-semibold text-red-700">{message}</p>}
      </div>
    );
  return (
    <div className="space-y-4">
      <button type="button" className="estate-button" onClick={() => { setForm(EMPTY_SOURCE); setEditing("new"); }}>
        Nova fonte de importação
      </button>
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Fonte</th>
              <th>Parceiro</th>
              <th>Formato</th>
              <th>Frequência</th>
              <th>Última execução</th>
              <th>Mapeamento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t border-zinc-100 align-top">
                <td className="py-2">
                  {s.name}
                  <br />
                  <span className="text-xs text-zinc-500">{s.kind} · {s.feed_mode}{s.active ? "" : " · inativa"}</span>
                </td>
                <td>{partnerName(s.partner_id)}</td>
                <td>{s.format.toUpperCase()}</td>
                <td>{s.frequency_hours ? `${s.frequency_hours} h` : "Manual"}</td>
                <td className="text-xs">
                  {when(s.last_run_at)} {s.last_status}
                  {s.last_error && <span className="block text-red-700">{s.last_error}</span>}
                </td>
                <td>{s.mapping ? `v${s.mapping.version}` : "—"}</td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <button
                    type="button"
                    className="text-brand-primary underline"
                    onClick={() => {
                      setForm({ ...EMPTY_SOURCE, partnerId: s.partner_id, name: s.name, kind: s.kind, format: s.format, feedMode: s.feed_mode, url: s.url, method: s.method, headers: "",
                        frequencyHours: s.frequency_hours ? String(s.frequency_hours) : "", missingTolerance: s.missing_tolerance, autoPublish: s.auto_publish, active: s.active,
                        options: { ...EMPTY_SOURCE.options, ...(s.options as typeof EMPTY_SOURCE.options), pagination: { ...EMPTY_SOURCE.options.pagination, ...((s.options.pagination ?? {}) as object) } } });
                      setEditing(s.id);
                    }}
                  >
                    Editar
                  </button>
                  {s.kind !== "upload" && (
                    <button type="button" className="text-brand-primary underline" disabled={!!busy} onClick={() => sync(s)}>
                      {busy === s.id ? "Sincronizando..." : "Sincronizar agora"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchesView({ batches, onOpen, onRefresh }: { batches: Record<string, unknown>[]; onOpen: (id: string) => void; onRefresh: () => Promise<void> }) {
  return (
    <div className="space-y-3">
      <button type="button" className="estate-button secondary" onClick={onRefresh}>Atualizar</button>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Data</th>
              <th>Parceiro / fonte</th>
              <th>Origem</th>
              <th>Situação</th>
              <th>Total</th>
              <th>Criados</th>
              <th>Atualizados</th>
              <th>Inválidos</th>
              <th>Arquivados</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={String(b.id)} className="border-t border-zinc-100">
                <td className="py-2 text-xs">{when(b.created_at)}</td>
                <td>{String(b.partner_name)} · {String(b.source_name)}</td>
                <td>{String(b.origin)}</td>
                <td>{String(b.status)}{b.error ? <span className="block text-xs text-red-700">{String(b.error)}</span> : null}</td>
                <td>{fmt(b.total)}</td>
                <td>{fmt(b.created)}</td>
                <td>{fmt(b.updated)}</td>
                <td>{fmt(b.invalid)}</td>
                <td>{fmt(b.archived)}</td>
                <td><button type="button" className="text-brand-primary underline" onClick={() => onOpen(String(b.id))}>Abrir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportedView({ partners }: { partners: Partner[] }) {
  const [filters, setFilters] = useState({ q: "", partner: "", status: "", sync: "", page: 1 });
  const [result, setResult] = useState<{ items: Record<string, unknown>[]; total: number }>({ items: [], total: 0 });
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const fetchPage = useCallback(
    () => integrationRequest<{ items: Record<string, unknown>[]; total: number }>(`/importados?${new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)]))}`),
    [filters],
  );
  const load = async () => {
    setResult(await fetchPage());
    setSelected([]);
  };
  useEffect(() => {
    fetchPage()
      .then((r) => {
        setResult(r);
        setSelected([]);
      })
      .catch((e) => setMessage((e as Error).message));
  }, [fetchPage]);
  async function bulk(action: string) {
    const label = action === "publish" ? "publicar" : action === "reject" ? "suspender (rejeitar)" : "devolver para análise";
    if (!window.confirm(`Confirmar: ${label} ${selected.length} imóvel(is)? A ação é reversível pelo painel.`)) return;
    const reason = action === "reject" ? window.prompt("Motivo:") ?? "" : "";
    try {
      const r = await integrationRequest<{ ok: number; total: number }>("/importados/lote", "POST", { ids: selected, action, reason, confirm: true });
      setMessage(`${r.ok} de ${r.total} alterados.`);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <input placeholder="Buscar título ou código" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })} />
        <select value={filters.partner} onChange={(e) => setFilters({ ...filters, partner: e.target.value, page: 1 })}>
          <option value="">Todos os parceiros</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS).filter(([k]) => k !== "removed" && k !== "draft").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.sync} onChange={(e) => setFilters({ ...filters, sync: e.target.value, page: 1 })}>
          <option value="">Toda sincronização</option>
          <option value="active">Presente no feed</option>
          <option value="missing">Ausente (em tolerância)</option>
          <option value="archived">Arquivado por ausência</option>
          <option value="removed_by_partner">Indisponível pelo parceiro</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="estate-button" disabled={!selected.length} onClick={() => bulk("publish")}>Aprovar selecionados</button>
        <button type="button" className="estate-button secondary" disabled={!selected.length} onClick={() => bulk("reject")}>Suspender selecionados</button>
        <button type="button" className="estate-button secondary" disabled={!selected.length} onClick={() => bulk("restore")}>Devolver para análise</button>
        <span className="self-center text-sm text-zinc-500">{fmt(result.total)} imóveis</span>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2"><input type="checkbox" aria-label="Selecionar todos" checked={selected.length > 0 && selected.length === result.items.length} onChange={(e) => setSelected(e.target.checked ? result.items.map((i) => String(i.id)) : [])} /></th>
              <th>Imóvel</th>
              <th>Parceiro / código</th>
              <th>Status</th>
              <th>Feed</th>
              <th>Fotos</th>
              <th>Acessos / contatos / cliques</th>
              <th>Sincronizado</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((i) => (
              <tr key={String(i.id)} className="border-t border-zinc-100">
                <td className="py-2"><input type="checkbox" aria-label="Selecionar" checked={selected.includes(String(i.id))} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, String(i.id)] : s.filter((x) => x !== i.id)))} /></td>
                <td>
                  <a className="text-brand-primary underline" href={`/imoveis/${String(i.slug)}`} target="_blank" rel="noreferrer">{String(i.title)}</a>
                  <br />
                  <span className="text-xs text-zinc-500">{String(i.neighborhood)}, {String(i.city)} · {Number(i.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </td>
                <td>{String(i.partner_name)}<br /><span className="text-xs text-zinc-500">{String(i.external_code)}</span></td>
                <td>{STATUS[String(i.status)] ?? String(i.status)}{i.reason ? <span className="block text-xs text-zinc-500">{String(i.reason)}</span> : null}</td>
                <td>{String(i.sync_status)}{Number(i.missing_count) ? ` (${String(i.missing_count)})` : ""}</td>
                <td>{String(i.photos)}</td>
                <td>{fmt(i.views)} / {fmt(i.contacts)} / {fmt(i.outbound_clicks)}</td>
                <td className="text-xs">{when(i.last_synced_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" className="estate-button secondary" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Anterior</button>
        <button type="button" className="estate-button secondary" disabled={filters.page * 25 >= result.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Próxima</button>
      </div>
    </div>
  );
}

function DuplicatesView() {
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const fetchItems = useCallback(() => integrationRequest<{ items: Record<string, unknown>[] }>(`/duplicidades?status=${status}`), [status]);
  const load = async () => setItems((await fetchItems()).items);
  useEffect(() => {
    fetchItems()
      .then((r) => setItems(r.items))
      .catch(() => {});
  }, [fetchItems]);
  async function resolve(id: unknown, next: string) {
    await integrationRequest(`/duplicidades/${String(id)}`, "POST", { status: next });
    await load();
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Possíveis duplicidades entre anunciantes diferentes. Nada é excluído automaticamente: cada parceiro mantém seu anúncio e seus direitos de divulgação. Confirmar apenas registra a conferência.</p>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-xs">
        <option value="open">Em aberto</option>
        <option value="confirmed">Confirmadas</option>
        <option value="distinct">Imóveis distintos</option>
      </select>
      {items.map((d) => (
        <div key={String(d.id)} className="rounded-xl border border-zinc-200 p-4 text-sm">
          <p className="mb-2 font-semibold">Pontuação {String(d.score)} — {(d.signals as string[]).join(", ")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {(["a", "b"] as const).map((k) => (
              <a key={k} href={`/imoveis/${String(d[`${k}_slug`])}`} target="_blank" rel="noreferrer" className="rounded-lg bg-zinc-50 p-3">
                <strong>{String(d[`${k}_title`])}</strong>
                <br />
                {String(d[`${k}_advertiser`])} · {Number(d[`${k}_price`]).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {STATUS[String(d[`${k}_status`])]}
              </a>
            ))}
          </div>
          {status === "open" && (
            <div className="mt-3 flex gap-2">
              <button type="button" className="estate-button secondary" onClick={() => resolve(d.id, "distinct")}>São imóveis distintos</button>
              <button type="button" className="estate-button secondary" onClick={() => resolve(d.id, "confirmed")}>Confirmar duplicidade</button>
            </div>
          )}
        </div>
      ))}
      {!items.length && <p className="text-sm text-zinc-500">Nenhum registro.</p>}
    </div>
  );
}

function LogsView({ partners }: { partners: Partner[] }) {
  const [partner, setPartner] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    integrationRequest<{ items: Record<string, unknown>[] }>(`/logs?partner=${partner}`).then((r) => setItems(r.items)).catch(() => {});
  }, [partner]);
  return (
    <div className="space-y-3">
      <select value={partner} onChange={(e) => setPartner(e.target.value)} className="max-w-xs">
        <option value="">Todos os parceiros</option>
        {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <ul className="divide-y divide-zinc-100 text-sm">
        {items.map((l) => (
          <li key={String(l.id)} className="py-2">
            <span className={l.level === "error" ? "text-red-700" : l.level === "warning" ? "text-amber-700" : "text-zinc-600"}>[{String(l.level)}]</span> {when(l.created_at)} · {String(l.partner_name ?? "—")} · {String(l.code)} — {String(l.message)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfigView() {
  return (
    <div className="space-y-3 text-sm text-zinc-700">
      <h2 className="text-lg font-semibold">Operação</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Sincronização automática: agende <code>GET /api/cron/imoveis-integracoes</code> a cada 15–60 minutos com o header <code>Authorization: Bearer &lt;segredo&gt;</code> (mesmos segredos do cron de Imóveis).</li>
        <li>Limites: arquivos de até 30 MB e 20.000 registros por lote; feeds de até 25 MB; até 20 fotos por imóvel.</li>
        <li>Imóveis ausentes de um feed completo só são pausados após a tolerância configurada na fonte e nunca após erro HTTP, timeout, arquivo vazio ou falha de leitura.</li>
        <li>Anúncios importados seguem a validade de 90 dias e são renovados a cada sincronização em que aparecem.</li>
        <li>Dados brutos dos lotes são descartados ao final da importação; registros antigos são limpos após 30 dias.</li>
      </ul>
      <h2 className="pt-2 text-lg font-semibold">Modelos para parceiros</h2>
      <div className="flex flex-wrap gap-2">
        <a className="estate-button secondary" href="/imoveis/modelos/MODELO_IMPORTACAO_IMOVEIS.xlsx" download>Planilha-modelo (.xlsx)</a>
        <a className="estate-button secondary" href="/imoveis/modelos/MODELO_IMPORTACAO_IMOVEIS.csv" download>CSV de exemplo</a>
        <a className="estate-button secondary" href="/imoveis/modelos/EXEMPLO_IMPORTACAO_IMOVEIS.json" download>JSON de exemplo</a>
        <a className="estate-button secondary" href="/imoveis/modelos/EXEMPLO_IMPORTACAO_IMOVEIS.xml" download>XML VRSync de exemplo</a>
      </div>
    </div>
  );
}
