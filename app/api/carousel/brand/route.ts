import { NextResponse } from "next/server";
import { getCarouselBrand, saveCarouselBrand } from "@/lib/carousel/backend/carousel-repository";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";
import { normalizeCarouselBrandInput } from "@/lib/carousel/backend/carousel-brand-input";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json({ brand: await getCarouselBrand(userId) });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}

/** PUT: salva a marca (nicho, público, tom, cor, @). Tudo validado em normalizeCarouselBrandInput. */
export async function PUT(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body) return badBody();
  try {
    const current = await getCarouselBrand(userId);
    const brand = await saveCarouselBrand(userId, { ...normalizeCarouselBrandInput(body), logoUrl: current?.logoUrl ?? null });
    return NextResponse.json({ brand });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
