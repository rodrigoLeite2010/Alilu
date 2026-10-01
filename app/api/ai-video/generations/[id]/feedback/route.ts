import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markGenerationLiked } from "@/lib/ai-video/backend/generation-repository";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST: "Gostei" (métrica de satisfação; não mexe em créditos). */
export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const ok = await markGenerationLiked(id, userId);
  if (!ok) return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
