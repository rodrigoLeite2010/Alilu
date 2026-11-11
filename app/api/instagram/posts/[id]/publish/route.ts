import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { InstagramPublishError, publishPost } from "@/lib/instagram/backend/instagram-publish-service";
import { getPostDetailsForUser } from "@/lib/instagram/backend/instagram-post-repository";
import {
  publishFacebookDestinationsForPost,
  type FacebookDestinationResult,
} from "@/lib/facebook/backend/facebook-publish-service";

export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * "Publicar agora" / "Tentar novamente" de uma publicação, em TODOS os
 * destinos escolhidos (Instagram e/ou Páginas do Facebook). Cada rede é
 * processada de forma independente: uma falha no Facebook não desfaz nem
 * republica o Instagram, e uma falha no Instagram não impede o Facebook.
 *
 * `?platform=instagram|facebook` restringe a uma rede (padrão: todas).
 *
 * Resposta (compatível com as telas antigas): `status` é o resultado do
 * Instagram (ou do Facebook, numa publicação "somente Facebook");
 * `facebook` traz o resultado de cada Página. Idempotente: destinos já
 * publicados só confirmam o status.
 */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const platform = new URL(request.url).searchParams.get("platform");
  const runInstagramPart = platform !== "facebook";
  const runFacebookPart = platform !== "instagram";

  const details = await getPostDetailsForUser(id, userId).catch(() => null);
  if (!details) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });

  let instagramStatus: string | null = null;
  let instagramError: string | null = null;
  if (runInstagramPart && details.publishToInstagram) {
    try {
      instagramStatus = await publishPost(id, userId);
    } catch (error) {
      console.error("[instagram/posts/publish] falha ao publicar", error instanceof Error ? error.message : "erro desconhecido");
      instagramError = error instanceof InstagramPublishError ? error.message : "Não foi possível publicar no Instagram.";
    }
  }

  let facebook: FacebookDestinationResult[] = [];
  if (runFacebookPart) {
    facebook = await publishFacebookDestinationsForPost(id, userId, "manual").catch(() => [
      { destinationId: "", accountName: null, status: "FAILED" as const, error: "Não foi possível publicar no Facebook." },
    ]);
  }

  const facebookFailures = facebook.filter((item) => item.status === "FAILED");
  const facebookOnly = !details.publishToInstagram;
  const status = facebookOnly
    ? facebook.some((item) => item.status === "PROCESSING")
      ? "PROCESSING"
      : facebook.length > 0 && facebook.every((item) => item.status === "PUBLISHED")
        ? "PUBLISHED"
        : facebook.some((item) => item.status === "RETRY_SCHEDULED")
          ? "RETRY_SCHEDULED"
          : null
    : instagramStatus;

  if (instagramError || facebookFailures.length > 0 || !status) {
    const parts: string[] = [];
    if (instagramError) parts.push(details.publishToInstagram && facebook.length > 0 ? `Instagram: ${instagramError}` : instagramError);
    for (const failure of facebookFailures) parts.push(`Facebook${failure.accountName ? ` (${failure.accountName})` : ""}: ${failure.error ?? "falhou"}`);
    if (instagramStatus === "PUBLISHED" && facebookFailures.length > 0) parts.unshift("Instagram: publicado.");
    const anySuccess = instagramStatus !== null || facebook.some((item) => item.status !== "FAILED");
    return NextResponse.json(
      { error: parts.join(" ") || "Não foi possível publicar.", status, instagram: instagramStatus, facebook, partial: anySuccess },
      { status: 400 },
    );
  }

  return NextResponse.json({ status, instagram: instagramStatus, facebook });
}
