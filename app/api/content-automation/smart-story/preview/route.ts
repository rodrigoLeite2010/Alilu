import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseAutomation } from "@/lib/billing/backend/automation-access-service";
import { buildSmartStoryPreview } from "@/lib/content-automation/backend/smart-story-preview";
import { callStoryAi } from "@/lib/content-automation/backend/smart-story-publication";
import { validateSmartStoryConfigInput, minuteOfDay } from "@/lib/content-automation/smart-story/config";

export const maxDuration = 60;

/**
 * POST — "Gerar exemplo" / "Gerar outro" do Modo inteligente de Stories.
 * NÃO publica e NÃO grava nada (nem Blob, nem banco, nem uso do plano).
 * Como a prévia do Story clássico, só quem pode usar o Piloto Automático
 * agora (teste ativo ou assinatura) gera com IA; sem isso devolve 403.
 *
 *   { config?, basePrompt?, brandContext?, time?: "HH:mm", nonce?, previousTypes? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const config = body.config ?? {};
  const problems = validateSmartStoryConfigInput(config);
  if (problems.length > 0) return NextResponse.json({ error: problems[0] }, { status: 400 });

  const time = typeof body.time === "string" && minuteOfDay(body.time) !== null ? body.time : "09:00";
  const basePrompt = typeof body.basePrompt === "string" ? body.basePrompt.slice(0, 4000) : "";
  const brandContext = typeof body.brandContext === "string" ? body.brandContext.slice(0, 4000) : "";
  const nonce = typeof body.nonce === "string" && body.nonce ? body.nonce.slice(0, 60) : String(Date.now());

  const access = await canUseAutomation(userId);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason ?? "A prévia está disponível durante o teste ou com a assinatura ativa." },
      { status: 403 },
    );
  }

  try {
    const preview = await buildSmartStoryPreview({
      rawConfig: config,
      basePrompt,
      brandContext,
      time,
      nonce,
      previousTypes: body.previousTypes,
      userId,
      callAi: callStoryAi,
    });
    return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[content-automation/smart-story/preview] falha ao gerar prévia", error);
    return NextResponse.json({ error: "Não foi possível gerar o exemplo agora. Tente novamente." }, { status: 502 });
  }
}
