import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { FacebookPagesFlowError, listFacebookPageCandidates } from "@/lib/facebook/backend/facebook-pages-service";

export const dynamic = "force-dynamic";

/** Páginas disponíveis numa tentativa de conexão (sem tokens). */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const attemptId = new URL(request.url).searchParams.get("attempt");
  if (!attemptId) return NextResponse.json({ error: "Tentativa inválida." }, { status: 400 });
  try {
    return NextResponse.json({ pages: await listFacebookPageCandidates(attemptId, userId) });
  } catch (error) {
    if (error instanceof FacebookPagesFlowError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível consultar suas Páginas agora." }, { status: 502 });
  }
}
