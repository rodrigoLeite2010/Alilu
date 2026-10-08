import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { SecretSantaError } from "./service";

type Ctx<P> = { params: Promise<P> };

export async function sessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Casca das rotas: exige login e injeta o userId DA SESSÃO (nunca do corpo/URL).
 * Posse/associação ao grupo é conferida no serviço a cada chamada. Respostas nunca são cacheadas.
 */
export function route<P = Record<string, never>>(
  handler: (args: { userId: string; params: P; request: Request }) => Promise<unknown>,
  successStatus = 200,
) {
  return async (request: Request, context?: Ctx<P>): Promise<NextResponse> => {
    const userId = await sessionUserId();
    if (!userId) return NextResponse.json({ error: "Faça login para usar o Amigo Secreto." }, { status: 401 });
    return run(handler, userId, request, context, successStatus);
  };
}

/** Variante pública (a rota decide o que mostrar com ou sem login). userId pode ser null. */
export function publicRoute<P = Record<string, never>>(
  handler: (args: { userId: string | null; params: P; request: Request }) => Promise<unknown>,
) {
  return async (request: Request, context?: Ctx<P>): Promise<NextResponse> => {
    return run(handler, await sessionUserId(), request, context, 200);
  };
}

async function run<P, U extends string | null>(
  handler: (args: { userId: U; params: P; request: Request }) => Promise<unknown>,
  userId: U,
  request: Request,
  context: Ctx<P> | undefined,
  successStatus: number,
): Promise<NextResponse> {
  try {
    const params = (context?.params ? await context.params : {}) as P;
    const data = await handler({ userId, params, request });
    return NextResponse.json({ data }, { status: successStatus, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SecretSantaError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    console.error(JSON.stringify({ scope: "secret-santa", event: "route.crash", message: (error as Error)?.message?.slice(0, 300) }));
    return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
  }
}
