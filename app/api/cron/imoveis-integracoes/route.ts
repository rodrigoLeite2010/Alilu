import { isStorageCleanupCronAuthorized } from "@/lib/storage-cleanup/backend/cron-auth";
import { runIntegrationCron } from "@/lib/imoveis/integracoes/sync";

// Agendar a cada 15–60 min com header Authorization: Bearer <segredo>.
// Cada execução respeita um orçamento de tempo e retoma lotes interrompidos.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isStorageCleanupCronAuthorized(request)) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const report = await runIntegrationCron(50000);
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("imoveis_integracoes_cron_failed", { name: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Falha na rotina" }, { status: 500 });
  }
}
