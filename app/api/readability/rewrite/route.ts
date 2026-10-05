import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { RewriteError, getRewriteQuota, isRewriteEnabled, rewriteText } from "@/lib/text/readability/backend/rewrite-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Estado da reescrita para a tela: ligada? logado? quanto já usou hoje? */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!isRewriteEnabled()) return NextResponse.json({ enabled: false, authenticated: Boolean(userId), quota: null });
  if (!userId) return NextResponse.json({ enabled: true, authenticated: false, quota: null });
  const quota = await getRewriteQuota(userId, session?.user?.email).catch(() => null);
  return NextResponse.json({ enabled: true, authenticated: true, quota }, { headers: { "Cache-Control": "no-store" } });
}

/** POST { text, goal, audience } → texto reescrito + análise antes/depois (IA só no servidor). */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Entre na sua conta para usar a reescrita com IA.", code: "UNAUTHENTICATED" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json(await rewriteText({ userId, email: session?.user?.email }, { text: body?.text, goal: body?.goal, audience: body?.audience }));
  } catch (error) {
    if (error instanceof RewriteError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error(JSON.stringify({ scope: "readability", event: "rewrite.crash", message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Não conseguimos simplificar o texto agora. Tente novamente." }, { status: 500 });
  }
}
