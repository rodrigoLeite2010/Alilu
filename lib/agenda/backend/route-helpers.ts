import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AgendaError } from "./agenda-service";

export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = () => NextResponse.json({ error: "Faça login para usar a Agenda." }, { status: 401 });

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function agendaError(error: unknown, event: string): NextResponse {
  if (error instanceof AgendaError) return NextResponse.json({ error: error.message }, { status: error.httpStatus });
  console.error(JSON.stringify({ scope: "agenda", event, message: (error as Error)?.message?.slice(0, 300) }));
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
}
