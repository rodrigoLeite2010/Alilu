import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { refreshGenerationForUser } from "@/lib/ai-video/backend/generation-service";
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
