import { NextResponse } from "next/server";
import { dismissTopic, suggestTopics } from "@/lib/carousel/backend/carousel-editorial-service";
import { listTopics } from "@/lib/carousel/backend/carousel-repository";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    const topics = (await listTopics(userId)).filter((topic) => topic.status === "NEW");
    return NextResponse.json({ topics });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}

/** POST { action: "suggest", mode: "WEEKLY"|"TRENDS"|"MANUAL", hint?, niche? } | { action: "dismiss", topicId } */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body) return badBody();
  try {
    if (body.action === "dismiss" && typeof body.topicId === "string") {
      return NextResponse.json({ ok: await dismissTopic(userId, body.topicId) });
    }
    if (body.action === "suggest") {
      const mode = body.mode === "TRENDS" || body.mode === "MANUAL" ? body.mode : "WEEKLY";
      const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, 200) : undefined;
      const niche = typeof body.niche === "string" ? body.niche.trim().slice(0, 80) : undefined;
      const topics = await suggestTopics(userId, { mode, hint, niche });
      return NextResponse.json({ topics });
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
