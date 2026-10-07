import { NextResponse } from "next/server";
import { getProjectView, runProjectAction } from "@/lib/carousel/backend/carousel-actions";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";
// Gerar, pesquisar e renderizar chamam IA / desenham imagens: precisam de tempo.
export const maxDuration = 300;
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await context.params;
    return NextResponse.json(await getProjectView(userId, id));
  } catch (error) {
    return carouselErrorResponse(error);
  }
}

/** POST { action, ... }: uma ação por chamada (ver PROJECT_ACTIONS). */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body) return badBody();
  try {
    const { id } = await context.params;
    return NextResponse.json(await runProjectAction(userId, id, body));
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
