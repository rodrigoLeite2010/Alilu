import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  AutomationValidationError,
  getAutomationDetails,
  listAutomationHistory,
} from "@/lib/content-automation/backend/automation-service";
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

  const history = await listAutomationHistory(id, userId);

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
          {history.map((run) => (
            <li key={run.id} className="rounded-md border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">{run.runDate}</span>
                <Badge tone={STATUS_TONE[run.status]}>{STATUS_LABEL[run.status]}</Badge>
              </div>
              {run.completedAt ? (
                <p className="mt-1 text-xs text-zinc-500">Concluído: {formatInTimeZone(run.completedAt.toISOString(), automation.timezone)}</p>
              ) : null}
              {run.errorMessage ? <p className="mt-1 text-xs text-red-700">{run.errorMessage}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
