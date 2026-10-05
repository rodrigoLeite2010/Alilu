import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEndMediaSummary, updateEndMediaSettings } from "@/lib/brand-end-media/backend/end-media-service";

/** Mídia final padrão do usuário logado (o dono vem SEMPRE da sessão, nunca do corpo). */
export async function GET(): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  return NextResponse.json(await getEndMediaSummary(userId), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  await updateEndMediaSettings(userId, body ?? {});
  return NextResponse.json(await getEndMediaSummary(userId));
}
