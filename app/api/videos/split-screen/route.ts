import { NextResponse } from "next/server";
import { parseSplitScreenRequest } from "@/lib/videos/validation";
import {
  VideoProcessingError,
  VideoProcessingValidationError,
  processSplitScreenVideo,
} from "@/lib/videos/backend/video-processing-service";

// Precisa do runtime Node.js (nunca Edge): roda o binário nativo do
// FFmpeg via child_process, o que o runtime Edge não suporta.
export const runtime = "nodejs";

// Mesmo teto já usado (e já validado em produção) por outras rotas deste
// projeto que fazem trabalho pesado em lote — ver
// app/api/cron/content-automation/route.ts. O orçamento de
// MAX_OUTPUT_DURATION_SECONDS (lib/videos/config.ts) foi pensado
// especificamente para caber dentro destes 60s (download dos 2 vídeos +
// decode + encode + upload do resultado).
export const maxDuration = 60;

/**
 * Processa o split-screen de dois vídeos já enviados ao Vercel Blob
 * (ver app/api/videos/upload/route.ts). Não requer login — ferramenta
 * pública da categoria "Vídeos" (Fase A).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = parseSplitScreenRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await processSplitScreenVideo(parsed.value);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VideoProcessingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Nunca vaza detalhes internos do FFmpeg/ffprobe na resposta ao
    // cliente — só loga estruturado no servidor (mesmo padrão de
    // lib/content-automation/backend/content-automation-cron.ts).
    console.error(
      JSON.stringify({
        scope: "videos",
        event: "split-screen.route-crash",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    const isKnownProcessingError = error instanceof VideoProcessingError;
    return NextResponse.json(
      { error: isKnownProcessingError ? error.message : "Não foi possível gerar o vídeo. Tente novamente." },
      { status: 500 },
    );
  }
}
