import { NextResponse } from "next/server";
import { analyzePublicProfile } from "@/lib/carousel/backend/carousel-editorial-service";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { target }: analisa só dados PÚBLICOS de um @perfil (padrões, não cópia). */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body || typeof body.target !== "string") return badBody();
  try {
    const analysis = await analyzePublicProfile(userId, body.target);
    return NextResponse.json({ analysis });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
