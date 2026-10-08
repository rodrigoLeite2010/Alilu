import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AllowanceError } from "./allowance-service";

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
 * Casca das rotas: exige login, injeta o userId DA SESSÃO (nunca do corpo/URL) e converte erros de regra.
 * A posse da criança/meta/tarefa é verificada no serviço a cada chamada.
 */
export function route<P = Record<string, never>>(
  handler: (args: { userId: string; params: P; request: Request }) => Promise<unknown>,
  successStatus = 200,
) {
  return async (request: Request, context?: Ctx<P>): Promise<NextResponse> => {
    const userId = await sessionUserId();
    if (!userId) return NextResponse.json({ error: "Faça login para usar a Mesada." }, { status: 401 });
    try {
      const params = (context?.params ? await context.params : {}) as P;
      const data = await handler({ userId, params, request });
      return NextResponse.json({ data }, { status: successStatus, headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (error instanceof AllowanceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
      console.error(JSON.stringify({ scope: "allowance", event: "route.crash", message: (error as Error)?.message?.slice(0, 300) }));
      return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
    }
  };
}
