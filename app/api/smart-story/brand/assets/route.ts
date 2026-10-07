import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  StoryBrandValidationError,
  removeStoryBrandAsset,
  saveStoryBrandAsset,
} from "@/lib/content-automation/backend/smart-story-brand-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json(await saveStoryBrandAsset(userId, { slot: body.slot, url: body.url }));
  } catch (error) {
    if (error instanceof StoryBrandValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(JSON.stringify({ scope: "smart-story-brand", event: "asset_save_failed", userId, message: error instanceof Error ? error.message : String(error) }));
    return NextResponse.json({ error: "Não foi possível salvar a imagem. Tente novamente." }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });
  try {
    return NextResponse.json(await removeStoryBrandAsset(userId, new URL(request.url).searchParams.get("slot")));
  } catch (error) {
    if (error instanceof StoryBrandValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Não foi possível remover a imagem." }, { status: 500 });
  }
}
