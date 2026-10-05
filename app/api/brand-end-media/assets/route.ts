import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { EndMediaValidationError, removeEndMedia, saveUploadedEndMedia } from "@/lib/brand-end-media/backend/end-media-service";

export const runtime = "nodejs";
// Valida com ffprobe e pré-normaliza o vídeo de encerramento (cache).
export const maxDuration = 120;

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
    return NextResponse.json(await saveUploadedEndMedia(userId, { slot: body.slot, url: body.url }));
  } catch (error) {
    if (error instanceof EndMediaValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(JSON.stringify({ scope: "end-media", event: "asset_save_failed", userId, message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Não foi possível salvar a mídia final. Tente novamente." }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  const slot = new URL(request.url).searchParams.get("slot");
  try {
    return NextResponse.json(await removeEndMedia(userId, slot));
  } catch (error) {
    if (error instanceof EndMediaValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível excluir a mídia final." }, { status: 500 });
  }
}
