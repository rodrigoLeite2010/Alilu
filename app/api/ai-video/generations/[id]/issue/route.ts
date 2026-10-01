import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AiVideoError } from "@/lib/ai-video/backend/generation-service";
import { reportGenerationIssue } from "@/lib/ai-video/backend/generation-issue-service";
import { getWallet } from "@/lib/ai-video/backend/wallet-repository";
import { serializeGenerationForUser, serializeWallet } from "@/lib/ai-video/backend/ai-video-dto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST { issueType, description }: "Reportar problema" de um vídeo concluído. */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed === "object" && parsed !== null) body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    const result = await reportGenerationIssue(userId, id, { issueType: body.issueType, description: body.description });
    const wallet = await getWallet(userId);
    return NextResponse.json({
      resolution: result.resolution,
      refundedCredits: result.refundedCredits,
      generation: serializeGenerationForUser(result.generation),
      wallet: serializeWallet(wallet),
    });
  } catch (error) {
    if (error instanceof AiVideoError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    console.error(JSON.stringify({ scope: "ai-video", event: "issue.crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Não foi possível registrar o problema agora." }, { status: 500 });
  }
}
