import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getInstagramAccountForUser,
  updateInstagramAccountDefaultMusic,
  removeInstagramAccountDefaultMusic,
} from "@/lib/instagram/backend/instagram-account-repository";
import { validateMusicSelection } from "@/lib/instagram/backend/post-request";

export const dynamic = "force-dynamic";

/**
 * "Música padrão para publicações" da conta do Instagram conectada.
 * GET devolve a configuração atual; PUT grava (usado pela tela de contas
 * conectadas); DELETE é o botão "Remover música padrão" — volta a conta
 * para o estado sem música (defaultMusic.type = "None", enabled = false).
 *
 * Sempre restrito ao dono da conta (userId da sessão), igual às demais
 * rotas de contas do Instagram.
 */

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const account = await getInstagramAccountForUser(userId);
  if (!account) {
    return NextResponse.json({ error: "Nenhuma conta do Instagram conectada." }, { status: 404 });
  }

  return NextResponse.json({ defaultMusic: account.defaultMusic });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const account = await getInstagramAccountForUser(userId);
  if (!account) {
    return NextResponse.json({ error: "Nenhuma conta do Instagram conectada." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { enabled } = body as Record<string, unknown>;
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Campo 'enabled' deve ser booleano." }, { status: 400 });
  }

  // Reaproveita a mesma validação usada para música de uma publicação —
  // mesmos campos (type/name/artist/externalId/url/audioFileUrl/audioFileName),
  // mesmos limites de tamanho.
  const result = validateMusicSelection(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (!result.selection) {
    return NextResponse.json({ error: "Campo 'type' é obrigatório." }, { status: 400 });
  }

  const updated = await updateInstagramAccountDefaultMusic(account.id, userId, {
    enabled,
    type: result.selection.type,
    name: result.selection.name,
    artist: result.selection.artist,
    externalId: result.selection.externalId,
    url: result.selection.url,
    audioFileUrl: result.selection.audioFileUrl,
    audioFileName: result.selection.audioFileName,
  });

  if (!updated) {
    return NextResponse.json({ error: "Não foi possível atualizar a conta." }, { status: 404 });
  }

  return NextResponse.json({ defaultMusic: updated.defaultMusic });
}

export async function DELETE(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const account = await getInstagramAccountForUser(userId);
  if (!account) {
    return NextResponse.json({ error: "Nenhuma conta do Instagram conectada." }, { status: 404 });
  }

  const updated = await removeInstagramAccountDefaultMusic(account.id, userId);
  if (!updated) {
    return NextResponse.json({ error: "Não foi possível atualizar a conta." }, { status: 404 });
  }

  return NextResponse.json({ defaultMusic: updated.defaultMusic });
}
