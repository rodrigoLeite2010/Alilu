/* eslint-disable @next/next/no-img-element */
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  STATUS,
  money,
  type Property,
  type Settings,
} from "@/lib/imoveis/model";
import { estateRequest } from "./client";
type AdminItem = Property & {
  user_id: string;
  history: {
    id: number;
    action: string;
    snapshot: unknown;
    created_at: string;
  }[];
};
type Report = {
  id: string;
  property_id: string;
  reason: string;
  title: string;
  slug: string;
  revision: number;
};
export function AdminPanel({
  items,
  reports,
  usage,
  config: initial,
  page,
}: {
  items: AdminItem[];
  reports: Report[];
  usage: { photos: number; bytes: string };
  config: Settings;
  page: number;
}) {
  const [config, setConfig] = useState(initial),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reasons, setReasons] = useState<Record<string, string>>({});
  const router = useRouter();
  async function run(path: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await estateRequest(`/admin/${path}`, "PUT", body);
      setMessage("Alteração salva.");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1 className="text-3xl font-bold">Administração de imóveis</h1>
      <p className="my-4 text-zinc-500">
        Análise manual antes da publicação. Aprovar um anúncio não certifica o
        imóvel nem o anunciante.
      </p>
      {message && (
        <p role="status" className="my-4 rounded-xl bg-brand-accent-soft p-4">
          {message}
        </p>
      )}
      <details className="estate-panel mb-6">
        <summary className="cursor-pointer font-semibold">
          Configuração e armazenamento ·{" "}
          {(Number(usage.bytes) / 1048576).toFixed(1)} MB reservados ·{" "}
          {usage.photos} fotos
        </summary>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run("settings", config);
          }}
        >
          {(
            [
              ["maxListings", "Anúncios por usuário", 1, 200],
              ["maxPhotos", "Fotos por anúncio", 1, 20],
              ["storageMB", "Orçamento de storage (MB)", 10, 10000],
            ] as const
          ).map(([k, l, min, max]) => (
            <label key={k}>
              {l}
              <input
                required
                type="number"
                min={min}
                max={max}
                value={config[k]}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, [k]: Number(e.target.value) }))
                }
              />
            </label>
          ))}
          <label>
            Tipos (um por linha)
            <textarea
              rows={7}
              value={config.types.join("\n")}
              onChange={(e) =>
                setConfig((c) => ({ ...c, types: e.target.value.split("\n") }))
              }
            />
          </label>
          <label className="sm:col-span-2">
            Características (uma por linha)
            <textarea
              rows={7}
              value={config.features.join("\n")}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  features: e.target.value.split("\n"),
                }))
              }
            />
          </label>
          <button className="estate-button" disabled={busy}>
            Salvar configurações
          </button>
        </form>
        <p className="mt-4 text-xs text-zinc-500">
          Este orçamento cobre somente a pasta de imóveis. Acompanhe também
          operações, transferência e uso total da conta no painel Vercel. Novos
          uploads são bloqueados ao atingir o orçamento.
        </p>
      </details>
      <section className="estate-panel mb-6">
        <h2 className="mb-4 text-xl font-semibold">
          Denúncias em aberto ({reports.length})
        </h2>
        {!reports.length && (
          <p className="text-sm text-zinc-500">Nenhuma denúncia pendente.</p>
        )}
        {reports.map((r) => (
          <article
            key={r.id}
            className="space-y-3 border-t border-zinc-100 py-4"
          >
            <p className="font-semibold">{r.title}</p>
            <p className="whitespace-pre-wrap text-sm">{r.reason}</p>
            <p className="text-xs text-zinc-500">Anúncio: {r.property_id}</p>
            <button
              disabled={busy}
              className="estate-button secondary"
              onClick={() => void run("report", { id: r.id })}
            >
              Marcar como analisada
            </button>
            <button
              disabled={busy}
              className="estate-button secondary ml-2"
              onClick={() =>
                void run(r.property_id, {
                  revision: r.revision,
                  status: "rejected",
                  reason:
                    "Bloqueado após denúncia. Entre em contato com a Alilu para revisão.",
                })
              }
            >
              Bloquear anúncio
            </button>
          </article>
        ))}
      </section>
      <section className="space-y-5">
        <h2 className="text-xl font-semibold">Anúncios · pendentes primeiro</h2>
        {items.map((p) => (
          <article key={p.id} className="estate-panel">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-brand-primary">
                  {STATUS[p.status]}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{p.data.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {p.data.city} / {p.data.state} · {money(p.data.price)} ·{" "}
                  {p.data.advertiser} ({p.data.advertiserType})
                </p>
                {p.data.creci && (
                  <p className="mt-2 text-sm">
                    CRECI informado: {p.data.creci}
                  </p>
                )}
              </div>
              <span className="text-xs text-zinc-400">{p.id}</span>
            </div>
            <details className="my-4">
              <summary className="cursor-pointer text-sm text-brand-primary underline">
                Conferir conteúdo, fotos e histórico
              </summary>
              <div className="my-4 flex gap-3 overflow-x-auto">
                {p.images.map((i) => (
                  <a
                    key={i.id}
                    href={i.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={i.thumbnail}
                      width={160}
                      height={120}
                      alt="Foto para moderação"
                      className="h-28 w-40 max-w-none rounded-lg object-cover"
                    />
                  </a>
                ))}
              </div>
              <p className="whitespace-pre-wrap text-sm">
                {p.data.description}
              </p>
              <pre className="my-4 max-h-72 overflow-auto rounded-xl bg-zinc-50 p-4 text-xs">
                {JSON.stringify(p.data, null, 2)}
              </pre>
              <h4 className="font-semibold">Histórico recente</h4>
              <Link
                href={`/admin/imoveis/historico/${p.id}`}
                className="my-3 inline-block text-sm text-brand-primary underline"
              >
                Consultar histórico completo →
              </Link>
              {p.history.map((h) => (
                <details key={h.id} className="my-2 text-xs">
                  <summary>
                    {h.action} ·{" "}
                    {new Date(h.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </summary>
                  <pre className="overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(h.snapshot, null, 2)}
                  </pre>
                </details>
              ))}
            </details>
            <label>
              Motivo / orientação para o anunciante
              <input
                maxLength={500}
                value={reasons[p.id] ?? ""}
                onChange={(e) =>
                  setReasons((r) => ({ ...r, [p.id]: e.target.value }))
                }
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              {p.status === "pending" && (
                <button
                  disabled={busy}
                  className="estate-button"
                  onClick={() =>
                    void run(p.id, {
                      status: "published",
                      reason: reasons[p.id],
                      revision: p.revision,
                    })
                  }
                >
                  Aprovar publicação
                </button>
              )}
              <button
                disabled={busy || !reasons[p.id]?.trim()}
                className="estate-button secondary"
                onClick={() =>
                  void run(p.id, {
                    status: "rejected",
                    reason: reasons[p.id],
                    revision: p.revision,
                  })
                }
              >
                Rejeitar / bloquear
              </button>
              <button
                disabled={busy || !reasons[p.id]?.trim()}
                className="estate-button secondary"
                onClick={() =>
                  void run(p.id, {
                    status: "removed",
                    reason: reasons[p.id],
                    revision: p.revision,
                  })
                }
              >
                Remover conteúdo
              </button>
              <button
                disabled={busy}
                className="text-sm text-red-700 underline"
                onClick={() =>
                  void run("suspend", { userId: p.user_id, suspended: true })
                }
              >
                Suspender anunciante
              </button>
              <button
                disabled={busy}
                className="text-sm text-brand-primary underline"
                onClick={() =>
                  void run("suspend", { userId: p.user_id, suspended: false })
                }
              >
                Liberar anunciante
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Antes de aprovar profissionais, confira o CRECI no conselho
              regional, as fotos, a autorização e possíveis dados pessoais no
              texto público.
            </p>
          </article>
        ))}
      </section>
      <nav
        aria-label="Paginação administrativa"
        className="mt-6 flex justify-center gap-5"
      >
        {page > 1 && <Link href={`?page=${page - 1}`}>← Anterior</Link>}
        {items.length === 25 && (
          <Link href={`?page=${page + 1}`}>Próxima →</Link>
        )}
      </nav>
    </>
  );
}
