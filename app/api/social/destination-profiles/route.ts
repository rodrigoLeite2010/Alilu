import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  DestinationAuthorizationError,
  getDestinationProfilesOverview,
  saveDestinationProfile,
} from "@/lib/facebook/backend/destination-authorization";
import { readProfileUpdate } from "@/lib/facebook/destination-policy";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Destinos por conta do Instagram ("categoria"): quais Páginas do Facebook
 * cada conta PODE usar e quais vêm marcadas como sugestão. Nunca devolve token.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const primary = await getInstagramAccountForUser(userId);
  const overview = await getDestinationProfilesOverview(userId, primary?.id ?? null);
  return NextResponse.json(overview);
}

/** Salva o perfil de UMA conta Instagram do usuário. Corpo: { instagramAccountId, label?, facebookEnabled, allowedFacebookPageRefs, defaultFacebookPageRefs }. */
export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const instagramAccountId = (body as { instagramAccountId?: unknown } | null)?.instagramAccountId;
  if (typeof instagramAccountId !== "string" || !UUID.test(instagramAccountId)) {
    return NextResponse.json({ error: "Conta do Instagram inválida." }, { status: 400 });
  }
  const parsed = readProfileUpdate(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const profile = await saveDestinationProfile(userId, instagramAccountId, parsed.value);
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof DestinationAuthorizationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[social/destination-profiles] falha ao salvar");
    return NextResponse.json({ error: "Não foi possível salvar os destinos da conta." }, { status: 500 });
  }
}
