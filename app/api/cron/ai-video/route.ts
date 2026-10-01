import { NextResponse } from "next/server";
import { isAiVideoCronRequestAuthorized } from "@/lib/ai-video/backend/cron-auth";
import { runAiVideoCron } from "@/lib/ai-video/backend/generation-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Cron da ferramenta "Imagem para vídeo com IA": avança as gerações em
 * andamento (envio com retry, consulta de status, cópia do MP4 para o
 * Blob, consumo/devolução de créditos) e apaga vídeos vencidos
 * (retenção). Recomendado: a cada 1 minuto, no mesmo disparador externo
 * dos outros crons. Protegido por "Authorization: Bearer <segredo>".
 */
async function handle(request: Request): Promise<NextResponse> {
  if (!isAiVideoCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await runAiVideoCron();
    return NextResponse.json(result);
  } catch (error) {
    console.error(JSON.stringify({ scope: "ai-video", event: "cron.crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Falha ao executar o cron de vídeos com IA." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
