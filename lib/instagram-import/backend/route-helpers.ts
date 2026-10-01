import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { InstagramImportError } from "./import-service";

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
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
