import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import Link from "next/link";
import {
  AutomationValidationError,
  getAutomationDetails,
  listAutomationHistoryDetailed,
} from "@/lib/content-automation/backend/automation-service";
import { RENEW_CONNECTION_MESSAGE } from "@/lib/instagram/backend/publish-errors";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { Badge } from "@/components/ui/Badge";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import type { AutomationRunStatus } from "@/lib/content-automation/backend/automation-types";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<AutomationRunStatus, string> = {
  PENDING: "Pendente",
  GENERATING: "Gerando",
  GENERATED: "Gerado",
  WAITING_APPROVAL: "Aguardando aprovação",
  SCHEDULED: "Agendado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

const STATUS_TONE: Record<AutomationRunStatus, "neutral" | "brand" | "warning"> = {
  PENDING: "neutral",
  GENERATING: "neutral",
  GENERATED: "neutral",
  WAITING_APPROVAL: "warning",
  SCHEDULED: "brand",
  PUBLISHING: "brand",
  PUBLISHED: "brand",
  FAILED: "warning",
  CANCELLED: "neutral",
};

/** Status da publicação na Meta (instagram_posts) — mais preciso que o da execução depois que o conteúdo foi gerado. */
const PUBLICATION_STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "brand" | "warning" }> = {
  DRAFT: { label: "Gerado", tone: "neutral" },
  SCHEDULED: { label: "Agendado", tone: "brand" },
  PROCESSING: { label: "Publicando", tone: "brand" },
  PUBLISHED: { label: "Publicado", tone: "brand" },
  FAILED: { label: "Erro", tone: "warning" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  NEEDS_REVIEW: { label: "Erro — precisa de atenção", tone: "warning" },
};

const CONTENT_TYPE_LABEL: Record<string, string> = { POST: "Post", CAROUSEL: "Carrossel", STORY: "Story", REEL: "Reel", SMART_CAROUSEL: "Carrossel Inteligente" };

function formatRunDate(runDate: string): string {
  const [year, month, day] = runDate.split("-");
  return `${day}/${month}/${year}`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Histórico de execuções da automação (seção 31). */
export default async function AutomationHistoryPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/piloto-automatico" />
      </div>
    );
  }

  const { id } = await params;
  const userId = session.user.id;

  let automation;
  try {
    automation = await getAutomationDetails(id, userId);
  } catch (error) {
    if (error instanceof AutomationValidationError) notFound();
    throw error;
  }

  const history = await listAutomationHistoryDetailed(id, userId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Histórico — {automation.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">Todas as execuções desta automação, mais recentes primeiro.</p>

      {history.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
          Nenhuma execução ainda.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {history.map((run) => {
            const publication = run.publicationStatus ? PUBLICATION_STATUS_LABEL[run.publicationStatus] : null;
            const badge = publication ?? { label: STATUS_LABEL[run.status], tone: STATUS_TONE[run.status] };
            const error = run.publicationError ?? run.errorMessage;
            const tokenExpired = error === RENEW_CONNECTION_MESSAGE;
            return (
              <li key={run.id} className="flex gap-3 rounded-md border border-zinc-200 p-3 text-sm">
                {run.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia da arte gerada (Vercel Blob público), miniatura simples.
                  <img
                    src={run.previewUrl}
                    alt={`Prévia de ${formatRunDate(run.runDate)}`}
                    className={`flex-none rounded border border-zinc-200 object-cover ${run.contentType === "STORY" ? "h-24 w-[54px]" : "h-16 w-16"}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-900">
                      {formatRunDate(run.runDate)}
                      {run.publishTime ? ` · ${run.publishTime}` : ""}
                      {run.contentType ? <span className="font-normal text-zinc-600"> · {CONTENT_TYPE_LABEL[run.contentType] ?? run.contentType}</span> : null}
                    </span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  {run.publishedAt ? (
                    <p className="mt-1 text-xs text-zinc-500">Publicado: {formatInTimeZone(run.publishedAt.toISOString(), automation.timezone)}</p>
                  ) : run.completedAt ? (
                    <p className="mt-1 text-xs text-zinc-500">Gerado: {formatInTimeZone(run.completedAt.toISOString(), automation.timezone)}</p>
                  ) : null}
                  {run.carouselProjectId ? (
                    <Link href={`/instagram/carrossel-inteligente/${run.carouselProjectId}`} className="mt-1 inline-flex min-h-8 items-center text-xs font-medium text-teal-800 underline">
                      Abrir carrossel
                    </Link>
                  ) : null}
                  {run.metaMediaId ? <p className="mt-1 text-xs text-zinc-500">ID da mídia no Instagram: {run.metaMediaId}</p> : null}
                  {tokenExpired ? (
                    <p className="mt-1 text-xs text-red-700">
                      Sua conexão com o Instagram expirou. Reconecte sua conta para continuar o piloto automático.{" "}
                      <Link href="/instagram/painel" className="font-medium underline">
                        Reconectar
                      </Link>
                    </p>
                  ) : error ? (
                    <p className="mt-1 text-xs text-red-700">{error}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
