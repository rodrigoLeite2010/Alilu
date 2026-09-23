import { NextResponse } from "next/server";
import { listDueScheduledPosts } from "@/lib/instagram/backend/instagram-post-repository";
import { InstagramPublishError, publishPost } from "@/lib/instagram/backend/instagram-publish-service";

export const maxDuration = 60;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function isAuthorized(request: Request): boolean {
  const secret = process.env.INSTAGRAM_SCHEDULER_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${secret}`;
}

/**
 * Executor de agendamentos. Não é um cron por si só: precisa ser chamado
 * por Vercel Cron, cron-job.org ou outro agendador externo usando
 * Authorization: Bearer INSTAGRAM_SCHEDULER_SECRET.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const duePosts = await listDueScheduledPosts(limit);
  const results: Array<{ postId: string; status: "PUBLISHED" | "PROCESSING" | "FAILED"; error?: string }> = [];

  for (const post of duePosts) {
    try {
      const status = await publishPost(post.id, post.userId);
      results.push({ postId: post.id, status });
    } catch (error) {
      results.push({
        postId: post.id,
        status: "FAILED",
        error: error instanceof InstagramPublishError ? error.message : "Falha ao publicar agendamento.",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
