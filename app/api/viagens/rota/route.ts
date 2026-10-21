import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { claimRouteQuota } from "@/lib/viagens/repository";
import { fetchRoadRoute, routingEnabled } from "@/lib/viagens/routing";
export async function POST(request: Request) {
  if (!routingEnabled()) return NextResponse.json({ error: "Rotas automáticas desativadas. Informe a distância manualmente." }, { status: 503 });
  const auth = await requireUserId(); if ("response" in auth) return auth.response;
  let input;
  try {
    const raw = await request.text(); if (raw.length > 3000) throw new Error(); input = JSON.parse(raw);
    if (![input.origin, input.destination].every(s => typeof s === "string" && s.trim().length > 1 && s.length <= 180) || !Array.isArray(input.stops) || input.stops.length > 5 || !input.stops.every((s: unknown) => typeof s === "string" && s.trim().length > 1 && s.length <= 180) || typeof input.roundTrip !== "boolean") throw new Error();
  } catch { return NextResponse.json({ error: "Informe origem, destino e até 5 paradas com cidade e estado." }, { status: 400 }); }
  try {
    if (!await claimRouteQuota(auth.userId)) return NextResponse.json({ error: "Limite de 10 consultas por dia atingido. Use o modo manual." }, { status: 429 });
    return NextResponse.json({ route: await fetchRoadRoute(input) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não foi possível consultar a rota. Informe a distância manualmente." }, { status: 503 }); }
}
