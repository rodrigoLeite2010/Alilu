import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AutomationValidationError, updateAutomationDay, getAutomationDetails } from "@/lib/content-automation/backend/automation-service";
import { serializeAutomation } from "@/lib/content-automation/backend/automation-dto";
import { DAYS_OF_WEEK, type AutomationContentMode, type AutomationContentType, type DayOfWeek } from "@/lib/content-automation/backend/automation-types";

interface RouteParams {
  params: Promise<{ id: string; day: string }>;
}

/**
 * PATCH: configura um dia específico da semana de uma automação (seção
 * 5/6 do briefing — "Publicar neste dia", formato, horário, prompt,
 * mídia). Corpo aceita qualquer subconjunto de campos (undefined =
 * mantém o valor atual).
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id, day } = await params;
  const dayOfWeek = day.toUpperCase() as DayOfWeek;
  if (!DAYS_OF_WEEK.includes(dayOfWeek)) {
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
    contentType,
    contentMode,
    prompt,
    manualCaption,
    visualText,
    publishTime,
    templateId,
    styleConfig,
    overlayOpacity,
    imageMediaId,
    videoMediaId,
  } = body as Record<string, unknown>;

  try {
    await updateAutomationDay(id, userId, dayOfWeek, {
      enabled: typeof enabled === "boolean" ? enabled : undefined,
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
      imageMediaId: imageMediaId === null ? null : typeof imageMediaId === "string" ? imageMediaId : undefined,
      videoMediaId: videoMediaId === null ? null : typeof videoMediaId === "string" ? videoMediaId : undefined,
    });
    const automation = await getAutomationDetails(id, userId);
    return NextResponse.json({ automation: serializeAutomation(automation) });
  } catch (error) {
    console.error("[content-automation/automations/id/days/day] falha ao atualizar dia", error);
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível atualizar este dia.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
