import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  startAutomationCheckout,
  cancelAutomationSubscription,
  reactivateAutomationSubscription,
  changeAutomationPlan,
  cancelScheduledPlanChange,
} from "@/lib/billing/backend/subscription-service";
import { serializeSubscription } from "@/lib/billing/backend/billing-dto";
import { isPlanCode } from "@/lib/billing/plans";
import { SubscriptionBusinessError } from "@/lib/billing/backend/billing-types";
import { AsaasApiError, AsaasConfigError } from "@/lib/billing/backend/asaas-client";

export const dynamic = "force-dynamic";

/**
 * POST: ações da assinatura do Piloto Automático, discriminadas por
 * `action` no corpo (mesmo padrão de outras rotas deste projeto com um
 * único endpoint por recurso). NUNCA fala com o Asaas diretamente —
 * sempre através de subscription-service.ts.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { action } = body as { action?: unknown };

  try {
    if (action === "checkout") {
      const { name, cpfCnpj, email, planCode } = body as {
        name?: unknown;
        cpfCnpj?: unknown;
        email?: unknown;
        planCode?: unknown;
      };
      if (!isPlanCode(planCode)) {
        return NextResponse.json({ error: "Escolha um plano para assinar." }, { status: 400 });
      }
      if (typeof name !== "string" || !name.trim() || typeof cpfCnpj !== "string" || !cpfCnpj.trim()) {
        return NextResponse.json({ error: "Nome e CPF/CNPJ são obrigatórios." }, { status: 400 });
      }
      const result = await startAutomationCheckout(userId, {
        planCode,
        name: name.trim(),
        cpfCnpj,
        email: typeof email === "string" && email.trim() ? email.trim() : undefined,
      });
      return NextResponse.json({
        checkoutUrl: result.checkoutUrl,
        subscription: serializeSubscription(result.subscription),
      });
    }

    if (action === "change-plan") {
      const { planCode } = body as { planCode?: unknown };
      if (!isPlanCode(planCode)) {
        return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
      }
      const result = await changeAutomationPlan(userId, planCode);
      if (result.kind === "upgrade") {
        return NextResponse.json({
          kind: "upgrade",
          checkoutUrl: result.checkoutUrl,
          amountCents: result.amountCents,
          subscription: serializeSubscription(result.subscription),
        });
      }
      return NextResponse.json({ kind: "downgrade", subscription: serializeSubscription(result.subscription) });
    }

    if (action === "cancel-plan-change") {
      const subscription = await cancelScheduledPlanChange(userId);
      return NextResponse.json({ subscription: serializeSubscription(subscription) });
    }

    if (action === "cancel") {
      const subscription = await cancelAutomationSubscription(userId);
      return NextResponse.json({ subscription: serializeSubscription(subscription) });
    }

    if (action === "reactivate") {
      const subscription = await reactivateAutomationSubscription(userId);
      return NextResponse.json({ subscription: serializeSubscription(subscription) });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    if (error instanceof SubscriptionBusinessError || error instanceof AsaasApiError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AsaasConfigError) {
      console.error(JSON.stringify({ scope: "billing", event: "subscription.config_error" }));
      return NextResponse.json(
        { error: "Pagamentos temporariamente indisponíveis. Tente novamente mais tarde." },
        { status: 503 },
      );
    }
    console.error(
      JSON.stringify({ scope: "billing", event: "subscription.crash", message: (error as Error)?.message }),
    );
    return NextResponse.json({ error: "Falha ao processar a solicitação." }, { status: 500 });
  }
}
