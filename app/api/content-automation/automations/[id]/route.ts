export const maxDuration = 300;
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  activateAutomation,
  archiveAutomation,
  AutomationValidationError,
  deleteAutomation,
  duplicateAutomation,
  getAutomationDetails,
  pauseAutomation,
  updateAutomation,
  updateSharedAutomation,
  updateSmartStory,
  updateSmartCarousel,
  previewSmartCarousel,
} from "@/lib/content-automation/backend/automation-service";
import { serializeAutomation } from "@/lib/content-automation/backend/automation-dto";
import type { AutomationScheduleMode, ImageMode, VideoSelection } from "@/lib/content-automation/backend/automation-types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: detalhes completos (config + 7 dias) de uma automação do próprio usuário. */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const automation = await getAutomationDetails(id, userId);
    return NextResponse.json({ automation: serializeAutomation(automation) });
  } catch (error) {
    if (error instanceof AutomationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[content-automation/automations/id] falha ao carregar", error);
    return NextResponse.json({ error: "Não foi possível carregar a automação." }, { status: 500 });
  }
}

/**
 * PATCH: `{ action: "update", ...campos }` | `{ action: "activate" }` |
 * `{ action: "pause", cancelScheduledRuns?: boolean }` (seção 30 — pausar
 * cancelando ou não as execuções já agendadas) | `{ action: "archive" }` |
 * `{ action: "duplicate" }` (seção 29 — retorna o id da cópia, sempre
 * PAUSADA) | `{ action: "update-shared", content?: {...}, schedule?:
 * { days: DayOfWeek[], times: "HH:mm"[] } }` (modo "Prompt único
 * recorrente": conteúdo compartilhado + agenda, validados juntos).
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { action } = body as { action?: unknown };

  try {
    if (action === "activate") {
      await activateAutomation(id, userId);
      return NextResponse.json({ status: "ACTIVE" });
    }

    if (action === "pause") {
      const { cancelScheduledRuns } = body as { cancelScheduledRuns?: unknown };
      await pauseAutomation(id, userId, { cancelScheduledRuns: cancelScheduledRuns === true });
      return NextResponse.json({ status: "PAUSED" });
    }

    if (action === "archive") {
      await archiveAutomation(id, userId);
      return NextResponse.json({ status: "ARCHIVED" });
    }

    if (action === "duplicate") {
      const newId = await duplicateAutomation(id, userId);
      return NextResponse.json({ id: newId }, { status: 201 });
    }

    if (action === "update-shared") {
      const { content, schedule } = body as { content?: unknown; schedule?: unknown };
      const isObject = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);
      if ((content !== undefined && !isObject(content)) || (schedule !== undefined && !isObject(schedule))) {
        return NextResponse.json({ error: "content e schedule precisam ser objetos." }, { status: 400 });
      }
      const weeklyExecutions = await updateSharedAutomation(id, userId, {
        content: content as Parameters<typeof updateSharedAutomation>[2]["content"],
        schedule: schedule as { days: unknown; times: unknown } | undefined,
      });
      const automation = await getAutomationDetails(id, userId);
      return NextResponse.json({ automation: serializeAutomation(automation), weeklyExecutions });
    }

    if (action === "update-smart-story") {
      const { enabled, config } = body as { enabled?: unknown; config?: unknown };
      await updateSmartStory(id, userId, { enabled: enabled as boolean | undefined, config });
      const automation = await getAutomationDetails(id, userId);
      return NextResponse.json({ automation: serializeAutomation(automation) });
    }

    if (action === "update-smart-carousel") {
      const { config } = body as { config?: unknown };
      await updateSmartCarousel(id, userId, { config });
      const automation = await getAutomationDetails(id, userId);
      return NextResponse.json({ automation: serializeAutomation(automation) });
    }

    if (action === "smart-carousel-preview") {
      const preview = await previewSmartCarousel(id, userId);
      return NextResponse.json({ projectId: preview.projectId, warnings: preview.warnings, category: preview.category, topic: preview.topic, diagnostic: preview.diagnostic });
    }

    if (action === "update") {
      const {
        name,
        description,
        timezone,
        brandContext,
        autoPublish,
        requireApproval,
        generationLeadMinutes,
        imageMode,
        fixedImageMediaId,
        videoSelection,
        fixedVideoMediaId,
        instagramAccountId,
        scheduleMode,
      } = body as Record<string, unknown>;

      await updateAutomation(id, userId, {
        name: typeof name === "string" ? name : undefined,
        description: typeof description === "string" ? description : undefined,
        timezone: typeof timezone === "string" ? timezone : undefined,
        brandContext: typeof brandContext === "string" ? brandContext : undefined,
        autoPublish: typeof autoPublish === "boolean" ? autoPublish : undefined,
        requireApproval: typeof requireApproval === "boolean" ? requireApproval : undefined,
        generationLeadMinutes: typeof generationLeadMinutes === "number" ? generationLeadMinutes : undefined,
        imageMode: typeof imageMode === "string" ? (imageMode as ImageMode) : undefined,
        fixedImageMediaId:
          fixedImageMediaId === null ? null : typeof fixedImageMediaId === "string" ? fixedImageMediaId : undefined,
        videoSelection: typeof videoSelection === "string" ? (videoSelection as VideoSelection) : undefined,
        fixedVideoMediaId:
          fixedVideoMediaId === null ? null : typeof fixedVideoMediaId === "string" ? fixedVideoMediaId : undefined,
        instagramAccountId: typeof instagramAccountId === "string" ? instagramAccountId : undefined,
        scheduleMode: typeof scheduleMode === "string" ? (scheduleMode as AutomationScheduleMode) : undefined,
      });
      const automation = await getAutomationDetails(id, userId);
      return NextResponse.json({ automation: serializeAutomation(automation) });
    }

    return NextResponse.json(
      { error: "action precisa ser 'update', 'update-shared', 'update-smart-story', 'activate', 'pause', 'archive' ou 'duplicate'." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[content-automation/automations/id] falha ao atualizar", error);
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível atualizar a automação.";
    return NextResponse.json({ error: message, code: error instanceof AutomationValidationError ? error.code : undefined }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteAutomation(id, userId);
    return NextResponse.json({ status: "DELETED" });
  } catch (error) {
    console.error("[content-automation/automations/id] falha ao excluir", error);
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível excluir a automação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
