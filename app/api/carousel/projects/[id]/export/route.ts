import { exportCarouselZip } from "@/lib/carousel/backend/carousel-publish-service";
import { carouselErrorResponse, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const runtime = "nodejs";

/** GET: ZIP com as artes (slide-01.jpg…). Só do dono do projeto. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    const { id } = await context.params;
    const { filename, buffer } = await exportCarouselZip(userId, id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
