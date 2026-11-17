import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { VideoQueueError } from "./queue-service";

export async function requireSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const unauthenticated = () => NextResponse.json({ error: "Não autenticado." }, { status: 401 });
export const badBody = () => NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });

export function videoQueueErrorResponse(error: unknown, event: string): NextResponse {
  if (error instanceof VideoQueueError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
  }
  console.error(JSON.stringify({ scope: "video-queue", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
}
