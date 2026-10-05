import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin/admin-access";
import { InstagramImportError } from "./import-service";

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Usuário da sessão + se é administrador (ADMIN_EMAILS, comparado no servidor). */
export async function requireImportUser(): Promise<{ userId: string; isAdmin: boolean } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return { userId, isAdmin: isAdminEmail(session?.user?.email) };
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function errorResponse(error: unknown, event: string): NextResponse {
  if (error instanceof InstagramImportError) {
    return NextResponse.json({ error: error.message, code: error.code, ...error.details }, { status: error.httpStatus });
  }
  console.error(JSON.stringify({ scope: "instagram-import", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json(
    { error: "Não conseguimos importar agora. Tente novamente ou faça upload manual.", code: "FAILED", manualUpload: true },
    { status: 500 },
  );
}
