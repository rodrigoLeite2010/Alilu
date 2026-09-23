import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  AutomationValidationError,
  createAutomation,
  listAutomations,
} from "@/lib/content-automation/backend/automation-service";
import { serializeAutomationListItem } from "@/lib/content-automation/backend/automation-dto";
import type { ImageMode, VideoSelection } from "@/lib/content-automation/backend/automation-types";

/**
 * GET: lista as automações do usuário ("Minhas automações", seção 29).
 * POST: cria uma nova automação (nasce PAUSADA e com os 7 dias
 * desabilitados — o usuário configura a semana e ativa explicitamente,
 * seção 44 do wizard).
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const automations = await listAutomations(userId);
    return NextResponse.json({ automations: automations.map(serializeAutomationListItem) });
  } catch (error) {
    console.error("[content-automation/automations] falha ao listar automações", error);
    return NextResponse.json({ error: "Não foi possível carregar as automações." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
    instagramAccountId,
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
  } = body as Record<string, unknown>;

  if (typeof instagramAccountId !== "string" || !instagramAccountId) {
    return NextResponse.json({ error: "instagramAccountId é obrigatório." }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name é obrigatório." }, { status: 400 });
  }

  try {
    const id = await createAutomation({
      userId,
      instagramAccountId,
      name,
      description: typeof description === "string" ? description : undefined,
      timezone: typeof timezone === "string" ? timezone : undefined,
      brandContext: typeof brandContext === "string" ? brandContext : undefined,
      autoPublish: typeof autoPublish === "boolean" ? autoPublish : undefined,
      requireApproval: typeof requireApproval === "boolean" ? requireApproval : undefined,
      generationLeadMinutes: typeof generationLeadMinutes === "number" ? generationLeadMinutes : undefined,
      imageMode: typeof imageMode === "string" ? (imageMode as ImageMode) : undefined,
      fixedImageMediaId: typeof fixedImageMediaId === "string" ? fixedImageMediaId : null,
      videoSelection: typeof videoSelection === "string" ? (videoSelection as VideoSelection) : undefined,
      fixedVideoMediaId: typeof fixedVideoMediaId === "string" ? fixedVideoMediaId : null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[content-automation/automations] falha ao criar automação", error);
    const message = error instanceof AutomationValidationError ? error.message : "Não foi possível criar a automação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
