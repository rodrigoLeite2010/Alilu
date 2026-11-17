import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import {
  MetaReviewError,
  getReviewOverview,
  refreshAccountProfile,
  setDemoPost,
  setManualCheck,
  startRecordingSession,
  verifyDemoPublication,
} from "@/lib/instagram/backend/meta-app-review-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function errorResponse(error: unknown): NextResponse {
  if (error instanceof MetaReviewError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
  console.error(JSON.stringify({ scope: "meta-app-review", event: "failed", message: (error as Error)?.message?.slice(0, 200) }));
  return NextResponse.json({ error: "Não foi possível concluir agora." }, { status: 500 });
}

/** Só administradores (ADMIN_EMAILS). Para os demais, a rota "não existe". */
export async function GET(): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  try {
    return NextResponse.json(await getReviewOverview(admin.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST { action: "start_session" }
 *      { action: "manual_check", key, done }
 *      { action: "refresh_profile", accountId }
 *      { action: "set_post", postId }
 *      { action: "verify_publication" }
 * A publicação em si usa as rotas existentes do Agendador (nada é publicado aqui).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    switch (body.action) {
      case "start_session":
        await startRecordingSession(admin.userId);
        return NextResponse.json({ ok: true });
      case "manual_check":
        await setManualCheck(admin.userId, String(body.key ?? ""), body.done === true);
        return NextResponse.json({ ok: true });
      case "refresh_profile":
        return NextResponse.json(await refreshAccountProfile(admin.userId, String(body.accountId ?? "")));
      case "set_post":
        await setDemoPost(admin.userId, String(body.postId ?? ""));
        return NextResponse.json({ ok: true });
      case "verify_publication":
        return NextResponse.json(await verifyDemoPublication(admin.userId));
      default:
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
