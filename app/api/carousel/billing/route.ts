import { NextResponse } from "next/server";
import { isCarouselPlanCode } from "@/lib/carousel/carousel-plans";
import {
  cancelCarouselSubscription,
  cancelScheduledCarouselPlanChange,
  changeCarouselPlan,
  getCarouselBillingState,
  reactivateCarouselSubscription,
  startCarouselCheckout,
} from "@/lib/carousel/backend/carousel-subscription-service";
import { serializeCarouselBilling, serializeCarouselSubscription } from "@/lib/carousel/backend/carousel-dto";
import { badBody, carouselErrorResponse, readJsonObject, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    return NextResponse.json(serializeCarouselBilling(await getCarouselBillingState(userId)));
  } catch (error) {
    return carouselErrorResponse(error, "carousel-billing");
  }
}

/**
 * POST { action }: checkout | change-plan | cancel-plan-change | cancel | reactivate.
 * O preço e o desconto NUNCA vêm do navegador: o servidor decide.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  const body = await readJsonObject(request);
  if (!body) return badBody();
  try {
    switch (body.action) {
      case "checkout": {
        if (!isCarouselPlanCode(body.planCode)) return NextResponse.json({ error: "Escolha um plano para assinar." }, { status: 400 });
        if (typeof body.name !== "string" || !body.name.trim() || typeof body.cpfCnpj !== "string" || !body.cpfCnpj.trim()) {
          return NextResponse.json({ error: "Nome e CPF/CNPJ são obrigatórios." }, { status: 400 });
        }
        const result = await startCarouselCheckout(userId, {
          planCode: body.planCode,
          name: body.name.trim().slice(0, 120),
          cpfCnpj: body.cpfCnpj,
          email: typeof body.email === "string" && body.email.trim() ? body.email.trim().slice(0, 160) : undefined,
        });
        return NextResponse.json({ checkoutUrl: result.checkoutUrl, subscription: serializeCarouselSubscription(result.subscription) });
      }
      case "change-plan": {
        if (!isCarouselPlanCode(body.planCode)) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
        const result = await changeCarouselPlan(userId, body.planCode);
        return NextResponse.json(
          result.kind === "upgrade"
            ? { kind: "upgrade", checkoutUrl: result.checkoutUrl, amountCents: result.amountCents, subscription: serializeCarouselSubscription(result.subscription) }
            : { kind: "downgrade", subscription: serializeCarouselSubscription(result.subscription) },
        );
      }
      case "cancel-plan-change":
        return NextResponse.json({ subscription: serializeCarouselSubscription(await cancelScheduledCarouselPlanChange(userId)) });
      case "cancel":
        return NextResponse.json({ subscription: serializeCarouselSubscription(await cancelCarouselSubscription(userId)) });
      case "reactivate":
        return NextResponse.json({ subscription: serializeCarouselSubscription(await reactivateCarouselSubscription(userId)) });
      default:
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (error) {
    return carouselErrorResponse(error, "carousel-billing");
  }
}
