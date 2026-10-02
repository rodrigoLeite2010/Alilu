import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { del as deleteBlob } from "@vercel/blob";
import { refreshGenerationForUser } from "@/lib/ai-video/backend/generation-service";
import { markGenerationDeletedByUser } from "@/lib/ai-video/backend/generation-repository";
import { getWallet } from "@/lib/ai-video/backend/wallet-repository";
import { serializeGenerationForUser, serializeWallet } from "@/lib/ai-video/backend/ai-video-dto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: estado da geração — e, se estiver na hora, já consulta o provedor (com lock, nunca em dobro). */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  try {
    const generation = await refreshGenerationForUser(id, userId);
    if (!generation) return NextResponse.json({ error: "Geração não encontrada." }, { status: 404 });
    const wallet = await getWallet(userId);
    return NextResponse.json({ generation: serializeGenerationForUser(generation), wallet: serializeWallet(wallet) });
  } catch (error) {
    console.error(JSON.stringify({ scope: "ai-video", event: "generation.refresh_crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Não foi possível consultar a geração." }, { status: 500 });
  }
}

/** DELETE: "Excluir vídeo" — apaga o MP4 do storage e tira do histórico (vídeos em andamento não podem). */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const removed = await markGenerationDeletedByUser(id, userId);
  if (!removed) return NextResponse.json({ error: "Vídeo não encontrado ou ainda em andamento." }, { status: 404 });
  if (removed.storageVideoUrl) {
    await deleteBlob(removed.storageVideoUrl).catch((error) =>
      console.error(JSON.stringify({ scope: "ai-video", event: "user_delete.blob_failed", generationId: id, message: (error as Error)?.message })),
    );
  }
  return NextResponse.json({ deleted: true });
}
