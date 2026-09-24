import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  AutomationValidationError,
  getAutomationDetails,
  listAutomationHistory,
} from "@/lib/content-automation/backend/automation-service";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { AutomationEditor } from "@/components/instagram/content-automation/AutomationEditor";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AutomationDetailPage({ params }: PageProps) {
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
  const pendingRuns = history
    .filter((run) => run.status === "WAITING_APPROVAL")
    .map((run) => ({ id: run.id, runDate: run.runDate, status: run.status, errorMessage: run.errorMessage }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900">{automation.name}</h1>
        <Link href={`/instagram/piloto-automatico/automacoes/${id}/historico`} className="text-sm font-medium text-teal-800 hover:underline">
          Ver histórico completo
        </Link>
      </div>
      <AutomationEditor
        userId={userId}
        automation={{
          id: automation.id,
          name: automation.name,
          description: automation.description,
          status: automation.status,
          timezone: automation.timezone,
          brandContext: automation.brandContext,
          autoPublish: automation.autoPublish,
          requireApproval: automation.requireApproval,
          generationLeadMinutes: automation.generationLeadMinutes,
          fixedImageMediaId: automation.fixedImageMediaId,
          fixedVideoMediaId: automation.fixedVideoMediaId,
          days: automation.days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            enabled: day.enabled,
            contentType: day.contentType,
            contentMode: day.contentMode,
            prompt: day.prompt,
            manualCaption: day.manualCaption ?? "",
            publishTime: day.publishTime,
            imageMediaId: day.imageMediaId,
            videoMediaId: day.videoMediaId,
          })),
        }}
        pendingRuns={pendingRuns}
      />
    </div>
  );
}
