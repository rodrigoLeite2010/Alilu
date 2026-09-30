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

// 200s (bem acima dos 60s usados pelas outras rotas deste projeto — ver
// app/api/cron/content-automation/route.ts): confirmado com o Rodrigo que
// a conta é Vercel Pro, que permite subir isso rota a rota (Hobby trava
// em 60s, sem exceção). Escopado só a esta rota — as demais continuam em
// 60s. Pensado para caber com folga MAX_OUTPUT_DURATION_SECONDS=150s
// (lib/videos/config.ts) + a sobra de download/probe/upload, mas ainda é
// uma estimativa: os logs de tempo por etapa em
// lib/videos/backend/video-processing-service.ts (adicionados depois do
// timeout com 149s/60s) mostram exatamente onde o tempo real é gasto —
// ajuste este número e/ou MAX_OUTPUT_DURATION_SECONDS a partir deles se
// um timeout acontecer de novo.
export const maxDuration = 200;

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
