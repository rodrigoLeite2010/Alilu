import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  AutomationValidationError,
  addAutomationSlot,
  getAutomationDetails,
  removeAutomationSlot,
  updateAutomationDay,
} from "@/lib/content-automation/backend/automation-service";
import { serializeAutomation } from "@/lib/content-automation/backend/automation-dto";
import {
  DAYS_OF_WEEK,
  type AutomationContentCategory,
  type AutomationContentMode,
  type AutomationContentType,
  type DayOfWeek,
} from "@/lib/content-automation/backend/automation-types";

interface RouteParams {
  params: Promise<{ id: string; day: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `[day]` aceita um dia da semana ("monday" → horário PRINCIPAL desse dia,
 * comportamento de sempre) ou o id (uuid) de um horário específico —
 * necessário desde que um dia pode ter vários horários (migração 0018).
 */
function parseDayRef(day: string): DayOfWeek | { slotId: string } | null {
  if (UUID_RE.test(day)) return { slotId: day };
  const dayOfWeek = day.toUpperCase() as DayOfWeek;
  return DAYS_OF_WEEK.includes(dayOfWeek) ? dayOfWeek : null;
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * POST /automations/{id}/days/{dia}: "+ Adicionar horário" nesse dia da
 * semana. Devolve a automação inteira atualizada (com o novo horário).
 */
export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id, day } = await params;
  const ref = parseDayRef(day);
  if (!ref || typeof ref !== "string") {
    return NextResponse.json({ error: "Dia da semana inválido." }, { status: 400 });
  }
  try {
    const slotId = await addAutomationSlot(id, userId, ref);
    const automation = await getAutomationDetails(id, userId);
    return NextResponse.json({ slotId, automation: serializeAutomation(automation) });
  } catch (error) {
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível adicionar o horário.";
    if (!(error instanceof AutomationValidationError)) console.error("[content-automation/days] falha ao adicionar horário", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /automations/{id}/days/{slotId}: remove um horário EXTRA (nunca o principal do dia). */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id, day } = await params;
  const ref = parseDayRef(day);
  if (!ref || typeof ref === "string") {
    return NextResponse.json({ error: "Informe o horário a remover." }, { status: 400 });
  }
  try {
    await removeAutomationSlot(id, userId, ref.slotId);
    const automation = await getAutomationDetails(id, userId);
    return NextResponse.json({ automation: serializeAutomation(automation) });
  } catch (error) {
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível remover o horário.";
    if (!(error instanceof AutomationValidationError)) console.error("[content-automation/days] falha ao remover horário", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * PATCH: configura um horário de uma automação (seção 5/6 do briefing —
 * "Publicar neste dia", formato, horário, prompt, mídia). Corpo aceita
 * qualquer subconjunto de campos (undefined = mantém o valor atual).
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id, day } = await params;
  const dayRef = parseDayRef(day);
  if (!dayRef) {
    return NextResponse.json({ error: "Dia da semana inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const {
    enabled,
    contentCategory,
    contentType,
    contentMode,
    prompt,
    manualCaption,
    visualText,
    publishTime,
    templateId,
    styleConfig,
    overlayOpacity,
    visualTextColor,
    imageMediaId,
    videoMediaId,
  } = body as Record<string, unknown>;

  try {
    await updateAutomationDay(id, userId, dayRef, {
      enabled: typeof enabled === "boolean" ? enabled : undefined,
      contentCategory:
        contentCategory === null
          ? null
          : typeof contentCategory === "string"
            ? (contentCategory as AutomationContentCategory)
            : undefined,
      contentType: typeof contentType === "string" ? (contentType as AutomationContentType) : undefined,
      contentMode: typeof contentMode === "string" ? (contentMode as AutomationContentMode) : undefined,
      prompt: typeof prompt === "string" ? prompt : undefined,
      manualCaption: manualCaption === null ? null : typeof manualCaption === "string" ? manualCaption : undefined,
      visualText: visualText === null ? null : typeof visualText === "string" ? visualText : undefined,
      publishTime: typeof publishTime === "string" ? publishTime : undefined,
      templateId: templateId === null ? null : typeof templateId === "string" ? templateId : undefined,
      styleConfig:
        styleConfig === null
          ? null
          : typeof styleConfig === "object" && styleConfig !== null && !Array.isArray(styleConfig)
            ? (styleConfig as Record<string, unknown>)
            : undefined,
      overlayOpacity: overlayOpacity === null ? null : typeof overlayOpacity === "number" ? overlayOpacity : undefined,
      visualTextColor: visualTextColor === null ? null : typeof visualTextColor === "string" ? visualTextColor : undefined,
      imageMediaId: imageMediaId === null ? null : typeof imageMediaId === "string" ? imageMediaId : undefined,
      videoMediaId: videoMediaId === null ? null : typeof videoMediaId === "string" ? videoMediaId : undefined,
    });
    const automation = await getAutomationDetails(id, userId);
    return NextResponse.json({ automation: serializeAutomation(automation) });
  } catch (error) {
    console.error("[content-automation/automations/id/days/day] falha ao atualizar dia", error);
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível atualizar este dia.";
    return NextResponse.json({ error: message, code: error instanceof AutomationValidationError ? error.code : undefined }, { status: 400 });
  }
}
