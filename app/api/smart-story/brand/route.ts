import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStoryBrandDto, saveStoryBrandTexts, StoryBrandValidationError } from "@/lib/content-automation/backend/smart-story-brand-service";

export const runtime = "nodejs";

/** Identidade visual dos Stories inteligentes do usuário logado (nome, @, site, cor, logo, mascote). */
export async function GET(): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  return NextResponse.json(await getStoryBrandDto(userId), { headers: { "Cache-Control": "no-store" } });
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
  try {
    return NextResponse.json(await saveStoryBrandTexts(userId, body));
  } catch (error) {
    if (error instanceof StoryBrandValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível salvar a identidade. Tente novamente." }, { status: 500 });
  }
}
