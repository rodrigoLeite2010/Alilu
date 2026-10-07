import { NextResponse } from "next/server";
import { createCarouselProject } from "@/lib/carousel/backend/carousel-project-service";
import { createProjectFromTopic, createProjectFromUrl } from "@/lib/carousel/backend/carousel-editorial-service";
import { listMyCarousels } from "@/lib/carousel/backend/carousel-publish-service";
import { CAROUSEL_PROJECT_STATUSES, type CarouselProjectStatus } from "@/lib/carousel/domain";
import { CAROUSEL_LIMITS } from "@/lib/carousel/carousel-plans";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    const raw = new URL(request.url).searchParams.get("status");
    const status = (CAROUSEL_PROJECT_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as CarouselProjectStatus) : undefined;
    const carousels = await listMyCarousels(userId, status ? { status } : undefined);
    return NextResponse.json({ carousels });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}

function slideCountOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= CAROUSEL_LIMITS.minSlides && value <= CAROUSEL_LIMITS.maxSlides ? value : undefined;
}

/**
 * POST: cria o rascunho (não consome cota nem chama IA).
 *  { from: "topic", topicId } | { from: "url", url } | { from: "custom", topic }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body) return badBody();
  const slideCount = slideCountOf(body.slideCount);
  const instagramAccountId = typeof body.instagramAccountId === "string" ? body.instagramAccountId : null;
  try {
    if (body.from === "topic" && typeof body.topicId === "string") {
      const project = await createProjectFromTopic(userId, body.topicId, { slideCount, instagramAccountId });
      return NextResponse.json({ projectId: project.id });
    }
    if (body.from === "url" && typeof body.url === "string") {
      const project = await createProjectFromUrl(userId, body.url, { slideCount });
      return NextResponse.json({ projectId: project.id });
    }
    if (body.from === "custom" && typeof body.topic === "string") {
      const topic = body.topic.replace(/\s+/g, " ").trim().slice(0, CAROUSEL_LIMITS.topic);
      if (topic.length < 3) return NextResponse.json({ error: "Descreva o tema do carrossel." }, { status: 400 });
      const project = await createCarouselProject({ userId, topic, sourceKind: "TOPIC", slideCount, instagramAccountId });
      return NextResponse.json({ projectId: project.id });
    }
    return NextResponse.json({ error: "Escolha um tema, uma pauta ou um link." }, { status: 400 });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
