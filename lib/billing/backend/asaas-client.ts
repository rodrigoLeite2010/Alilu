import "server-only";

/**
 * Cliente cru da API do Asaas (gateway de pagamento usado SOMENTE para a
 * assinatura do Piloto Automático de Conteúdo — o resto do Alilu não usa
 * Asaas). Só HTTP + parsing defensivo aqui; nenhuma regra de negócio
 * (isso fica em subscription-service.ts) e nenhum acesso a banco.
 *
 * Endpoints, campos obrigatórios e formato de autenticação verificados na
 * documentação oficial (docs.asaas.com) antes de escrever este arquivo —
 * nunca inventados. Credenciais SOMENTE via variável de ambiente
 * (ASAAS_API_KEY/ASAAS_BASE_URL), nunca hardcoded; a chave nunca é
 * logada, nem em mensagem de erro.
 */

export class AsaasConfigError extends Error {}

export class AsaasApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getBaseUrl(): string {
  const baseUrl = process.env.ASAAS_BASE_URL;
  if (!baseUrl) {
    throw new AsaasConfigError(
      "ASAAS_BASE_URL não configurada. Use https://api-sandbox.asaas.com/v3 (Sandbox) ou https://api.asaas.com/v3 (produção).",
    );
  }
  return baseUrl.replace(/\/+$/, "");
}

function getApiKey(): string {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new AsaasConfigError("ASAAS_API_KEY não configurada.");
  }
  return apiKey;
}

function extractAsaasErrorMessage(payload: unknown): string | null {
  if (isRecord(payload) && Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (isRecord(first) && typeof first.description === "string") return first.description;
  }
  return null;
}

async function asaasRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> },
): Promise<T> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      // Formato de autenticação do Asaas: header "access_token" com a chave
      // crua — NÃO é "Authorization: Bearer".
      access_token: apiKey,
      "User-Agent": "Alilu Utilitarios (https://alilu.com.br)",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await response.text();
  const payload = safeParseJson(text);

  if (!response.ok) {
    // O erro nunca inclui a chave/headers — só o corpo da resposta do Asaas.
    const message = extractAsaasErrorMessage(payload) ?? `Asaas respondeu ${response.status} para ${path}.`;
    throw new AsaasApiError(message, response.status, payload ?? text);
  }

  return (payload ?? {}) as T;
}

export interface AsaasCustomerInput {
  name: string;
  /** CPF ou CNPJ, só dígitos — obrigatório: o Asaas não cria cliente sem isso. */
  cpfCnpj: string;
  email?: string;
}

export interface AsaasCustomer {
  id: string;
}

/** POST /v3/customers */
export async function createAsaasCustomer(input: AsaasCustomerInput): Promise<AsaasCustomer> {
  const result = await asaasRequest<{ id: string }>("/customers", {
    method: "POST",
    body: { name: input.name, cpfCnpj: input.cpfCnpj, email: input.email },
  });
  return { id: result.id };
}

export interface AsaasSubscriptionInput {
  customerId: string;
  /** Em reais (ex.: 19.00) — o Asaas não trabalha em centavos; a conversão de automation_subscriptions.monthly_price_cents acontece na borda, em subscription-service.ts. */
  value: number;
  /** "YYYY-MM-DD" — primeira data de cobrança. */
  nextDueDate: string;
  description?: string;
  /** Liga a assinatura do Asaas de volta ao automation_subscriptions.id local — usado pelo webhook para achar a linha certa. */
  externalReference?: string;
}

export interface AsaasSubscription {
  id: string;
  status: string;
  /** "YYYY-MM-DD" — data da PRÓXIMA cobrança. Depois de um pagamento confirmado, é isso que usamos como "até quando o período pago atual vale" (current_period_ends_at). */
  nextDueDate: string | null;
}

/**
 * POST /v3/subscriptions — cria uma assinatura recorrente DE VERDADE
 * (cycle MONTHLY), nunca uma cobrança avulsa criada manualmente pelo
 * Alilu todo mês. billingType "UNDEFINED": deixa o próprio checkout
 * hospedado do Asaas decidir Pix/Boleto/Cartão — o Alilu nunca vê nem
 * processa dado de cartão.
 *
 * IMPORTANTE (já avisado pelo usuário): criar a assinatura aqui NÃO
 * significa liberar acesso — só o Webhook (ou uma consulta
 * servidor-servidor como getAsaasSubscription) confirma o pagamento.
 */
export async function createAsaasSubscription(input: AsaasSubscriptionInput): Promise<AsaasSubscription> {
  const result = await asaasRequest<{ id: string; status: string; nextDueDate?: string }>("/subscriptions", {
    method: "POST",
    body: {
      customer: input.customerId,
      billingType: "UNDEFINED",
      cycle: "MONTHLY",
      value: input.value,
      nextDueDate: input.nextDueDate,
      description: input.description,
      externalReference: input.externalReference,
    },
  });
  return { id: result.id, status: result.status, nextDueDate: result.nextDueDate ?? null };
}

/**
 * GET /v3/subscriptions/{id} — consulta servidor-servidor, para
 * reconciliar o status local com o Asaas quando necessário (nunca
 * confiar num redirect do navegador para liberar acesso).
 */
export async function getAsaasSubscription(subscriptionId: string): Promise<AsaasSubscription> {
  const result = await asaasRequest<{ id: string; status: string; nextDueDate?: string }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "GET" },
  );
  return { id: result.id, status: result.status, nextDueDate: result.nextDueDate ?? null };
}

export interface AsaasPayment {
  id: string;
  status: string;
  /** A que assinatura essa cobrança pertence — o corpo do Webhook só traz o id do pagamento, então é essa consulta que liga o evento de volta à assinatura do Piloto Automático. */
  subscription: string | null;
  value: number;
}

/** GET /v3/payments/{id} — consulta servidor-servidor usada pelo processamento do Webhook (nunca confia só no corpo do evento recebido). */
export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  const result = await asaasRequest<{ id: string; status: string; subscription?: string | null; value?: number }>(
    `/payments/${encodeURIComponent(paymentId)}`,
    { method: "GET" },
  );
  return {
    id: result.id,
    status: result.status,
    subscription: typeof result.subscription === "string" ? result.subscription : null,
    value: Number(result.value ?? 0),
  };
}

/** DELETE /v3/subscriptions/{id} — cancela no Asaas, para de gerar novas cobranças a partir daqui. */
export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
}

export interface AsaasSubscriptionPayment {
  id: string;
  status: string;
  /** Link do checkout hospedado do Asaas (Pix/Boleto/Cartão) — é para lá que o assinante é redirecionado para pagar. */
  invoiceUrl: string | null;
  value: number;
  dueDate: string;
}

/**
 * GET /v3/subscriptions/{id}/payments — a criação da assinatura
 * (createAsaasSubscription) não devolve um link de pagamento direto; o
 * Asaas gera a primeira cobrança de forma assíncrona, e é o campo
 * invoiceUrl dessa cobrança que serve como link do checkout. Usado logo
 * depois de criar a assinatura, para obter esse link.
 */
export async function listAsaasSubscriptionPayments(subscriptionId: string): Promise<AsaasSubscriptionPayment[]> {
  const result = await asaasRequest<{ data?: unknown }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
    { method: "GET" },
  );
  const items = Array.isArray(result?.data) ? result.data : [];
  return items.filter(isRecord).map((item) => ({
    id: String(item.id ?? ""),
    status: String(item.status ?? ""),
    invoiceUrl: typeof item.invoiceUrl === "string" ? item.invoiceUrl : null,
    value: Number(item.value ?? 0),
    dueDate: String(item.dueDate ?? ""),
  }));
}

export interface AsaasOneTimePaymentInput {
  customerId: string;
  /** Em reais (ex.: 19.9). */
  value: number;
  /** "YYYY-MM-DD" — vencimento da cobrança. */
  dueDate: string;
  description?: string;
  /** Liga a cobrança de volta à compra local (ai_credit_purchases.id). */
  externalReference?: string;
}

export interface AsaasOneTimePayment {
  id: string;
  status: string;
  /** Página de pagamento hospedada do Asaas (Pix/Boleto/Cartão). */
  invoiceUrl: string | null;
}

/**
 * POST /v3/payments — cobrança AVULSA (compra de créditos de IA). Mesmo
 * billingType "UNDEFINED" da assinatura: a pessoa escolhe Pix, boleto ou
 * cartão no checkout hospedado do Asaas — o Alilu nunca vê dado de
 * cartão. Criar a cobrança NÃO libera créditos: só o Webhook confirmado.
 */
export async function createAsaasPayment(input: AsaasOneTimePaymentInput): Promise<AsaasOneTimePayment> {
  const result = await asaasRequest<{ id: string; status: string; invoiceUrl?: string }>("/payments", {
    method: "POST",
    body: {
      customer: input.customerId,
      billingType: "UNDEFINED",
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    },
  });
  return { id: result.id, status: result.status, invoiceUrl: typeof result.invoiceUrl === "string" ? result.invoiceUrl : null };
}

/** POST /v3/payments/{id}/refund — estorno total de uma cobrança paga (reembolso de créditos não usados). */
export async function refundAsaasPayment(paymentId: string): Promise<void> {
  await asaasRequest(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: "POST", body: {} });
}
