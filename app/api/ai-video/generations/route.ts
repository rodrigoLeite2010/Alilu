import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AiVideoError, createGeneration } from "@/lib/ai-video/backend/generation-service";
import { listGenerationsForUser, clearDraft } from "@/lib/ai-video/backend/generation-repository";
import { getWallet } from "@/lib/ai-video/backend/wallet-repository";
import { serializeGenerationForUser, serializeWallet } from "@/lib/ai-video/backend/ai-video-dto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: histórico de gerações do usuário + saldo. */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const [generations, wallet] = await Promise.all([listGenerationsForUser(userId), getWallet(userId)]);
  return NextResponse.json({ generations: generations.map(serializeGenerationForUser), wallet: serializeWallet(wallet) });
}

/**
 * POST { idempotencyKey, imageUrl, prompt, tier, durationSeconds, aspectRatio }:
 * "GERAR VÍDEO". O custo é SEMPRE recalculado no servidor — o valor
 * mostrado na tela nunca é usado. 402 = créditos insuficientes (com
 * quanto falta); a requisição ao provedor nunca acontece nesse caso.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const generation = await createGeneration(userId, {
      idempotencyKey: String(body.idempotencyKey ?? ""),
      imageUrl: String(body.imageUrl ?? ""),
      prompt: String(body.prompt ?? ""),
      tier: String(body.tier ?? ""),
      durationSeconds: Number(body.durationSeconds),
      aspectRatio: String(body.aspectRatio ?? ""),
    });
    await clearDraft(userId);
    const wallet = await getWallet(userId);
    return NextResponse.json({ generation: serializeGenerationForUser(generation), wallet: serializeWallet(wallet) });
  } catch (error) {
    if (error instanceof AiVideoError) {
      return NextResponse.json({ error: error.message, code: error.code, ...error.details }, { status: error.httpStatus });
    }
    console.error(JSON.stringify({ scope: "ai-video", event: "generation.crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Não foi possível iniciar a geração agora." }, { status: 500 });
  }
}
