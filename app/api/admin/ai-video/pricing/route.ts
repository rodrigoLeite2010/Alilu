import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import {
  AdminPricingError,
  updateModelPricingAdmin,
  updatePackageAdmin,
  updatePricingConfig,
  updateProviderAccountAdmin,
} from "@/lib/ai-video/backend/admin-service";

/** PATCH { action: "config" | "model" | "package" | "provider", id?, ...campos } — só ADMIN_EMAILS. */
export async function PATCH(request: Request): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) as Record<string, unknown>) ?? {};
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    if (body.action === "config") await updatePricingConfig(body);
    else if (body.action === "model") await updateModelPricingAdmin(String(body.id ?? ""), body);
    else if (body.action === "package") await updatePackageAdmin(String(body.id ?? ""), body);
    else if (body.action === "provider") await updateProviderAccountAdmin(body);
    else return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    console.info("[ai-video] admin alterou precificação", { admin: admin.email, action: body.action, id: body.id ?? null });
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof AdminPricingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(JSON.stringify({ scope: "ai-video", event: "admin.pricing_crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
