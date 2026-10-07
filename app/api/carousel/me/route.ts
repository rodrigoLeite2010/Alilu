import { NextResponse } from "next/server";
import { listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { CAROUSEL_TEMPLATES } from "@/lib/carousel/design/templates";
import { getCarouselBrand } from "@/lib/carousel/backend/carousel-repository";
import { getCarouselBillingState } from "@/lib/carousel/backend/carousel-subscription-service";
import { maxProfilesFor } from "@/lib/carousel/backend/carousel-project-service";
import { serializeCarouselBilling } from "@/lib/carousel/backend/carousel-dto";
import { carouselErrorResponse, requireUserId, unauthorized } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";

/** GET: tudo que a home do módulo precisa — plano/cota, marca, perfis do Instagram e modelos. */
export async function GET(): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return unauthorized();
  try {
    const [billing, brand, accounts, maxProfiles] = await Promise.all([
      getCarouselBillingState(userId),
      getCarouselBrand(userId),
      listInstagramAccountsForUser(userId),
      maxProfilesFor(userId),
    ]);
    return NextResponse.json({
      billing: serializeCarouselBilling(billing),
      brand,
      maxProfiles,
      accounts: accounts.map((account) => ({ id: account.id, username: account.igUsername, status: account.status })),
      templates: CAROUSEL_TEMPLATES.map((template) => ({ id: template.id, name: template.name, description: template.description })),
    });
  } catch (error) {
    return carouselErrorResponse(error);
  }
}
