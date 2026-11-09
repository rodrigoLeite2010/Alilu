import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  SplitBottomValidationError,
  getSplitBottomSummary,
  removeSplitBottomMedia,
  saveSplitBottomMedia,
} from "@/lib/videos/split-bottom/split-bottom-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Valida o vídeo com ffprobe / converte a imagem para JPEG.
export const maxDuration = 120;

/** Mídia fixa da parte de baixo do Split Screen, por conta do Instagram (só o dono). */
export async function GET(): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ accounts: [] });
  try {
    return NextResponse.json(await getSplitBottomSummary(userId));
  } catch {
    return NextResponse.json({ accounts: [] });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json(await saveSplitBottomMedia(userId, { instagramAccountId: body.instagramAccountId, url: body.url }));
  } catch (error) {
    if (error instanceof SplitBottomValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(JSON.stringify({ scope: "split-bottom", event: "save_failed", userId, message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Não foi possível salvar a mídia. Tente novamente." }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const accountId = new URL(request.url).searchParams.get("instagramAccountId");
  try {
    return NextResponse.json(await removeSplitBottomMedia(userId, accountId));
  } catch (error) {
    if (error instanceof SplitBottomValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível excluir a mídia." }, { status: 500 });
  }
}
