import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getSmartStoryDiagnostics } from "@/lib/content-automation/backend/smart-story-diagnostics";
import { STORY_CAPABILITIES, STORY_TYPE_LABEL, isStoryType } from "@/lib/content-automation/smart-story/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Stories inteligentes", robots: { index: false, follow: false } };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Admin › Stories inteligentes — diagnóstico agregado (sem tokens, chaves nem prompts). */
export default async function AdminSmartStoriesPage() {
  const admin = await getAdminSession();
  if (!admin) notFound();
  const diag = await getSmartStoryDiagnostics(30);
  const fallbackPct = diag.total > 0 ? Math.round((diag.bySource.FALLBACK / diag.total) * 100) : 0;
  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Stories inteligentes — Diagnóstico</h1>
      <p className="mt-1 text-sm text-zinc-600">Últimos {diag.windowDays} dias. Automações com o modo ligado: {diag.automationsEnabled}.</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-zinc-500">Stories gerados</dt>
          <dd className="text-xl font-semibold">{diag.total}</dd>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-zinc-500">Texto da IA</dt>
          <dd className="text-xl font-semibold">{diag.bySource.AI}</dd>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-zinc-500">Texto de reserva</dt>
          <dd className="text-xl font-semibold">
            {diag.bySource.FALLBACK} <span className="text-sm font-normal text-zinc-500">({fallbackPct}%)</span>
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-zinc-500">Com mascote</dt>
          <dd className="text-xl font-semibold">{diag.mascotCount}</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Por status</h2>
        <p className="mt-2 text-sm text-zinc-700">
          {Object.keys(diag.byStatus).length === 0
            ? "Nenhum Story ainda."
            : Object.entries(diag.byStatus)
                .map(([status, count]) => `${status}: ${count}`)
                .join(" · ")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Por tipo</h2>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {diag.byType.map((row) => (
            <li key={row.type} className="flex justify-between border-b border-zinc-100 py-1">
              <span>{isStoryType(row.type) ? STORY_TYPE_LABEL[row.type] : row.type}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Capacidades do Instagram (API oficial)</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Enquete nativa: {STORY_CAPABILITIES.supportsNativePoll ? "sim" : "não"} · Pergunta: {STORY_CAPABILITIES.supportsQuestionSticker ? "sim" : "não"} ·
          Link: {STORY_CAPABILITIES.supportsLinkSticker ? "sim" : "não"}. Enquetes são desenhadas na imagem.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Últimos problemas (falha, reserva ou erro)</h2>
        {diag.recentProblems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nenhum problema recente.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {diag.recentProblems.map((item) => (
              <li key={item.id} className="py-2">
                <span className="text-zinc-500">{dateFmt.format(new Date(item.at))}</span> ·{" "}
                {isStoryType(item.storyType) ? STORY_TYPE_LABEL[item.storyType] : item.storyType} · {item.status} · {item.source} · {item.attempts}{" "}
                {item.attempts === 1 ? "tentativa" : "tentativas"}
                <span className="block text-xs text-zinc-500">automação {item.automationId}</span>
                {item.error ? <span className="block break-words text-xs text-red-700">{item.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
