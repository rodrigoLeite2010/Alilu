import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin/admin-access";
import { YoutubeImportError } from "./import-service";

/** Usuário da sessão + se é administrador (ADMIN_EMAILS, comparado no servidor — nunca vem do corpo). */
export async function requireYoutubeImportUser(): Promise<{ userId: string; isAdmin: boolean } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return { userId, isAdmin: isAdminEmail(session?.user?.email) };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Entre na sua conta para usar o importador.", code: "UNAUTHENTICATED" }, { status: 401 });
}

export function youtubeErrorResponse(error: unknown, event: string): NextResponse {
  if (error instanceof YoutubeImportError) {
    return NextResponse.json({ error: error.message, code: error.code, ...error.details }, { status: error.httpStatus });
  }
  console.error(JSON.stringify({ scope: "youtube-import", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json({ error: "Algo deu errado do nosso lado. Tente novamente em instantes.", code: "FAILED" }, { status: 500 });
}
