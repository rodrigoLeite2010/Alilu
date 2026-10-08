/** Cliente fino das rotas /api/carousel/* (usado só no navegador). */
export class CarouselApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(message);
  }
}

export async function carouselApi<T = Record<string, unknown>>(path: string, init?: { method?: string; body?: Record<string, unknown> }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    const data = (json ?? {}) as { error?: unknown; code?: unknown };
    throw new CarouselApiError(typeof data.error === "string" && data.error ? data.error : "Não foi possível concluir agora. Tente novamente.", response.status, typeof data.code === "string" ? data.code : null);
  }
  return json as T;
}

export const projectAction = <T = Record<string, unknown>>(id: string, body: Record<string, unknown>) => carouselApi<T>(`/api/carousel/projects/${id}`, { body });

export const formatBrl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface PlanOfferDto {
  code: "STARTER" | "PRO" | "TURBO" | "AGENCY";
  name: string;
  carouselsPerCycle: number;
  maxProfiles: number;
  highlighted: boolean;
  features: readonly string[];
  upcoming: readonly string[];
  listPriceCents: number;
  priceCents: number;
  discountPercent: number;
  current: boolean;
}

export interface BillingDto {
  access: { kind: "PLAN" | "TRIAL" | "ADMIN" | "NONE"; allowed: boolean; planCode: string | null; planName: string | null; used: number; limit: number; code: string | null; reason: string | null };
  subscription: {
    planCode: string;
    pendingPlanCode: string | null;
    status: string;
    priceCents: number;
    listPriceCents: number;
    discountPercent: number;
    complimentary: boolean;
    currentPeriodEndsAt: string | null;
  } | null;
  existingAliluCustomer: boolean;
  plans: PlanOfferDto[];
}

export interface MeDto {
  billing: BillingDto;
  brand: {
    brandName: string | null;
    handle: string | null;
    niche: string | null;
    audience: string | null;
    objective: string | null;
    tone: string | null;
    accentColor: string | null;
    secondaryColor: string | null;
    fontId: string | null;
    defaultTemplateId: string | null;
    logoUrl: string | null;
  } | null;
  maxProfiles: number;
  accounts: Array<{ id: string; username: string | null; status: string }>;
  templates: Array<{ id: string; name: string; description: string }>;
}

export const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-zinc-100 text-zinc-700" },
  GENERATING: { label: "Gerando", className: "bg-amber-50 text-amber-800" },
  READY: { label: "Pronto", className: "bg-brand-primary-soft text-brand-primary" },
  SCHEDULED: { label: "Agendado", className: "bg-blue-50 text-blue-700" },
  PUBLISHED: { label: "Publicado", className: "bg-teal-50 text-teal-800" },
  FAILED: { label: "Erro", className: "bg-red-50 text-red-700" },
};
