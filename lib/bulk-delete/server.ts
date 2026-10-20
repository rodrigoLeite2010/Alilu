import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BulkNotFoundError, parseBulkIds, runBulkDelete, type BulkDeleteResult } from "./core";

export interface BulkDeleteRouteOptions {
  /** Identificador curto do módulo, usado no log de auditoria (ex.: "instagram-posts"). */
  module: string;
  /** Exclui UM item do usuário logado, reutilizando a regra da exclusão individual. Lança para falhar. */
  deleteOne: (id: string, userId: string) => Promise<void>;
  /** Erros de regra de negócio cuja mensagem pode ir para a tela. Outros viram mensagem genérica. */
  isUserError?: (error: unknown) => boolean;
  /** Erros que significam "já não existe" — tratados como sucesso (idempotência em reenvios). */
  isAlreadyGone?: (error: unknown) => boolean;
  idPattern?: RegExp;
  max?: number;
  concurrency?: number;
}

/**
 * Fábrica do POST de exclusão em massa: autentica, valida/deduplica os ids,
 * aplica a regra individual a cada item (sempre com o userId da SESSÃO — o
 * cliente nunca informa o dono), tolera falhas parciais e registra um evento
 * de auditoria sem dados pessoais (só contagens e ids internos).
 */
export function createBulkDeleteHandler(options: BulkDeleteRouteOptions) {
  return async function POST(request: Request): Promise<NextResponse<BulkDeleteResult | { error: string }>> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
    }
    const parsed = parseBulkIds(body, { idPattern: options.idPattern, max: options.max });
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await runBulkDelete(parsed.ids, (id) => options.deleteOne(id, userId), {
      concurrency: options.concurrency,
      isUserError: options.isUserError,
      isAlreadyGone: (error) => error instanceof BulkNotFoundError || Boolean(options.isAlreadyGone?.(error)),
      onUnexpectedError: (id, error) =>
        console.error(`[bulk-delete:${options.module}] falha inesperada`, { id, message: (error as Error)?.message }),
    });

    console.info(
      JSON.stringify({
        event: "bulk_delete",
        module: options.module,
        userId,
        requested: parsed.ids.length,
        deleted: result.deleted.length,
        failed: result.failed.length,
      }),
    );
    return NextResponse.json(result);
  };
}
