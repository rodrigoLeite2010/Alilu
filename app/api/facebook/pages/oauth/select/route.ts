import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { FacebookPagesFlowError, connectSelectedFacebookPages } from "@/lib/facebook/backend/facebook-pages-service";

export const dynamic = "force-dynamic";

/** Salva SOMENTE as Páginas escolhidas explicitamente pelo usuário. */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sua sessão Alilu expirou. Entre novamente." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { attemptId?: unknown; pageIds?: unknown } | null;
  if (!body || typeof body.attemptId !== "string" || !Array.isArray(body.pageIds)) {
    return NextResponse.json({ error: "Selecione ao menos uma Página." }, { status: 400 });
  }
  try {
    const result = await connectSelectedFacebookPages(body.attemptId, userId, body.pageIds.filter((id): id is string => typeof id === "string"));
    const back = result.returnTo ?? "/instagram/painel";
    const separator = back.includes("?") ? "&" : "?";
    return NextResponse.json({ ok: true, connected: result.pages.length, redirect: `${back}${separator}status=facebook-conectado` });
  } catch (error) {
    if (error instanceof FacebookPagesFlowError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível conectar as Páginas. Nenhuma conexão existente foi alterada." }, { status: 502 });
  }
}
