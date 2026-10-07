import { NextResponse } from "next/server";
import {
  DEFAULT_CONTENT_AUTOMATION_LIMIT,
  isContentAutomationCronRequestAuthorized,
  runContentAutomationCron,
} from "@/lib/content-automation/backend/content-automation-cron";
import { generateWeeklyTopics } from "@/lib/carousel/backend/carousel-editorial-service";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Cron do Piloto Automático de Conteúdo — SÓ gera e agenda conteúdo
 * (nunca fala com a Meta). Separado de /api/cron/instagram-publish de
 * propósito (ver docs/content-automation.md): dois crons, uma única
 * camada de publicação. Protegido por `Authorization: Bearer <segredo>`
 * (CONTENT_AUTOMATION_CRON_SECRET, ou os mesmos CRON_SECRET /
 * INSTAGRAM_SCHEDULER_SECRET já usados pelo outro cron).
 */
function parseLimit(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? DEFAULT_CONTENT_AUTOMATION_LIMIT);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 50) : DEFAULT_CONTENT_AUTOMATION_LIMIT;
}

async function handle(request: Request): Promise<NextResponse> {
  if (!isContentAutomationCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const results = await runContentAutomationCron({ limit: parseLimit(request) });
    // Pautas semanais do Carrossel Inteligente: idempotente por semana, em lotes
    // pequenos (cada usuário usa 1 chamada de IA com busca) e sem derrubar o cron.
    let carouselTopics: { processed: number; generated: number; failed: number } | null = null;
    if (process.env.CONTENT_AI_API_KEY && process.env.CONTENT_AI_MODEL) {
      try {
        carouselTopics = await generateWeeklyTopics({ limit: 2 });
      } catch (error) {
        console.error(JSON.stringify({ scope: "carousel", event: "weekly-topics.crash", message: (error as Error)?.message }));
      }
    }
    return NextResponse.json({ processed: results.length, results, carouselTopics });
  } catch (error) {
    console.error(JSON.stringify({ scope: "content-automation", event: "cron.crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Falha ao executar o cron do Piloto Automático." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
