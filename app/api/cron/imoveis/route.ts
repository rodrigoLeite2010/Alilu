import { isStorageCleanupCronAuthorized } from "@/lib/storage-cleanup/backend/cron-auth";
import { cleanupImages } from "@/lib/imoveis/images";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!isStorageCleanupCronAuthorized(request))
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  return Response.json(await cleanupImages(), {
    headers: { "Cache-Control": "no-store" },
  });
}
