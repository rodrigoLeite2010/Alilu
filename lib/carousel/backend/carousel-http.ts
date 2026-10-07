/**
 * Utilidades HTTP compartilhadas pelas rotas /api/carousel/*: autenticação,
 * leitura do corpo e tradução de erros de domínio em respostas amigáveis.
 * Nenhuma rota fala com banco/IA/Asaas diretamente — só com os serviços.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AsaasApiError, AsaasConfigError } from "@/lib/billing/backend/asaas-client";
import { SubscriptionBusinessError } from "@/lib/billing/backend/billing-types";
import { CarouselError, type CarouselErrorCode } from "./carousel-project-service";
import { CarouselLlmError } from "./carousel-llm";

const STATUS_BY_CODE: Record<CarouselErrorCode, number> = {
  NOT_FOUND: 404,
  INVALID: 400,
  PROFILE_LIMIT: 409,
  ACCESS_DENIED: 402,
  INCOMPLETE: 409,
  BAD_TRANSITION: 409,
  BUSY: 429,
  AI_UNAVAILABLE: 503,
  LIMIT: 429,
};

export function carouselErrorStatus(code: CarouselErrorCode): number {
  return STATUS_BY_CODE[code] ?? 400;
}

export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = (): NextResponse => NextResponse.json({ error: "Não autenticado." }, { status: 401 });

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const badBody = (): NextResponse => NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });

/** Traduz qualquer erro em resposta. Nunca devolve detalhes técnicos nem segredos. */
export function carouselErrorResponse(error: unknown, scope = "carousel"): NextResponse {
  if (error instanceof CarouselError) {
    const body: Record<string, unknown> = { error: error.message, code: error.code };
    if (error.code === "ACCESS_DENIED" && error.access) {
      body.access = { code: error.access.code, used: error.access.used, limit: error.access.limit };
    }
    return NextResponse.json(body, { status: carouselErrorStatus(error.code) });
  }
  if (error instanceof SubscriptionBusinessError || error instanceof AsaasApiError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof AsaasConfigError) {
    console.error(JSON.stringify({ scope, event: "config_error" }));
    return NextResponse.json({ error: "Pagamentos temporariamente indisponíveis. Tente novamente mais tarde." }, { status: 503 });
  }
  if (error instanceof CarouselLlmError) {
    console.error(JSON.stringify({ scope, event: "llm_error" }));
    return NextResponse.json({ error: "A IA está indisponível agora. Tente novamente em instantes.", code: "AI_UNAVAILABLE" }, { status: 503 });
  }
  console.error(JSON.stringify({ scope, event: "crash", message: (error as Error)?.message }));
  return NextResponse.json({ error: "Não foi possível concluir agora. Tente novamente." }, { status: 500 });
}
