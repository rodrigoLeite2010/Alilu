import { NextResponse } from "next/server";
import { isCarouselTemplateId } from "@/lib/carousel/design/templates";
import { generateCarouselProject, type GenerateCarouselRequest } from "@/lib/carousel/backend/carousel-generation-service";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

/**
 * POST: gera um carrossel COMPLETO (tema → texto → fotos → artes → legenda)
 * pelo mesmo serviço usado pelo automatizador. Não publica e não consome cota.
 * { topic, category?, prompt?, slideCount?, templateMode?, templateId?, imageSource?, addFinalImage?, generateCaption? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body) return badBody();
  const str = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);
  const input: GenerateCarouselRequest = {
    userId,
    topic: str(body.topic, 200),
    category: str(body.category, 80) ?? null,
    prompt: str(body.prompt, 600) ?? null,
    slideCount: typeof body.slideCount === "number" ? body.slideCount : undefined,
    templateMode: body.templateMode === "FIXED" && isCarouselTemplateId(body.templateId) ? "FIXED" : "AUTO",
    templateId: typeof body.templateId === "string" ? body.templateId : null,
    imageSource: body.imageSource === "NONE" ? "NONE" : "AUTO",
    addFinalImage: typeof body.addFinalImage === "boolean" ? body.addFinalImage : undefined,
    generateCaption: typeof body.generateCaption === "boolean" ? body.generateCaption : undefined,
  };
  try {
    const result = await generateCarouselProject(input);
    return NextResponse.json({ projectId: result.project.id, status: result.project.status, stagesRun: result.stagesRun, warnings: result.warnings });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
