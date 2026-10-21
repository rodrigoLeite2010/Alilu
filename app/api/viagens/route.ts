import { NextResponse } from "next/server";
import { requireUserId, isUuid } from "@/lib/auth/session";
import { parseTrip } from "@/lib/viagens/planner";
import { listTrips, saveTrip, deleteTrip } from "@/lib/viagens/repository";
const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  const auth = await requireUserId(); if ("response" in auth) return auth.response;
  try { return response({ trips: await listTrips(auth.userId) }); }
  catch { return response({ error: "Salvamento na conta indisponível. Seu planejamento continua disponível nesta tela." }, 503); }
}
export async function POST(request: Request) {
  const auth = await requireUserId(); if ("response" in auth) return auth.response;
  let body, plan;
  try {
    const raw = await request.text(); if (raw.length > 200000) return response({ error: "Viagem muito grande." }, 413);
    body = JSON.parse(raw); plan = parseTrip(body.plan);
    if ((body.id !== null && (typeof body.id !== "string" || !isUuid(body.id))) || !Number.isInteger(body.revision) || body.revision < 0 || typeof body.archived !== "boolean") throw new Error("Identificação inválida.");
  } catch (e) { return response({ error: e instanceof Error ? e.message : "Dados inválidos." }, 400); }
  try {
    const trip = await saveTrip(auth.userId, plan, body.id, body.revision, body.archived);
    if (!trip) return response({ error: "Viagem alterada em outra aba, removida ou limite de 100 viagens atingido. Recarregue a lista antes de salvar." }, 409);
    return response({ trip }, body.id ? 200 : 201);
  } catch { return response({ error: "Não foi possível salvar na conta. Mantenha esta tela aberta ou salve um rascunho local." }, 503); }
}
export async function DELETE(request: Request) {
  const auth = await requireUserId(); if ("response" in auth) return auth.response;
  const id = new URL(request.url).searchParams.get("id"); if (!id || !isUuid(id)) return response({ error: "Identificação inválida." }, 400);
  try { return await deleteTrip(auth.userId, id) ? response({ ok: true }) : response({ error: "Viagem não encontrada." }, 404); }
  catch { return response({ error: "Não foi possível excluir." }, 503); }
}
