import { isStorageCleanupCronAuthorized } from "@/lib/storage-cleanup/backend/cron-auth";
import { cleanupImages } from "@/lib/imoveis/images";
import { cleanupProductImages } from "@/lib/desapego/images";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!isStorageCleanupCronAuthorized(request))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const [properties, products] = await Promise.all([cleanupImages(), cleanupProductImages()]);
  return Response.json({ properties, products }, {
    headers: { "Cache-Control": "no-store" },
  });
}
