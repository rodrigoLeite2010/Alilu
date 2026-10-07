import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import { isCarouselPlanCode } from "@/lib/carousel/carousel-plans";
import { adminEndCarouselComplimentary, adminGrantCarouselPlan } from "@/lib/carousel/backend/carousel-subscription-service";
import { writeAuditLog } from "@/lib/admin/user-admin-service";
import { getUserEmail } from "@/lib/carousel/backend/carousel-repository";
import { badBody, carouselErrorResponse, readJsonObject } from "@/lib/carousel/backend/carousel-http";

export const dynamic = "force-dynamic";

/** POST { action: "grant", userId, planCode, days, note } | { action: "end", userId } — só ADMIN_EMAILS. */
export async function POST(request: Request): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const body = await readJsonObject(request);
  if (!body || typeof body.userId !== "string") return badBody();
  try {
    if (body.action === "grant") {
      if (!isCarouselPlanCode(body.planCode)) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
      const days = typeof body.days === "number" ? body.days : Number(body.days);
      const note = typeof body.note === "string" ? body.note : null;
      const email = await getUserEmail(body.userId);
      if (!email) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
      await adminGrantCarouselPlan(body.userId, body.planCode, days, note);
      await writeAuditLog(admin, { id: body.userId, email }, "carousel-grant-plan", { planCode: body.planCode, days, note });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "end") {
      const email = await getUserEmail(body.userId);
      if (!email) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
      const ended = await adminEndCarouselComplimentary(body.userId);
      await writeAuditLog(admin, { id: body.userId, email }, "carousel-end-complimentary", { ended });
      return NextResponse.json({ ok: ended });
    }
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    return carouselErrorResponse(error, "carousel-admin");
  }
}
