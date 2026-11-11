import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { FacebookPublishError, publishFacebookDestination } from "@/lib/facebook/backend/facebook-publish-service";

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * "Tentar novamente" de UM destino (ex.: só o Facebook). Não toca no
 * Instagram nem em outros destinos. Antes de qualquer novo envio, a camada
 * de publicação confere na Página se um envio anterior já foi publicado.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  try {
    const status = await publishFacebookDestination(id, userId, { trigger: "retry" });
    return NextResponse.json({ status });
  } catch (error) {
    const message = error instanceof FacebookPublishError ? error.message : "Não foi possível publicar no Facebook.";
    const reason = error instanceof FacebookPublishError ? error.reason : "other";
    return NextResponse.json({ error: message, reason }, { status: 400 });
  }
}
