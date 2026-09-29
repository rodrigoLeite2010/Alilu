import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/lotteries/backend/repository";
import { requireUserId } from "@/lib/lotteries/backend/session";
import { parseSettingsInput } from "@/lib/lotteries/validation";

/**
 * GET/PUT do limite mensal de investimento (Fase 2) — opcional, e sempre
 * só para acompanhamento (a UI nunca deve transformar isto num alerta
 * agressivo ou bloqueio; ver components/lotteries/MeusJogos.tsx).
 */
export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  try {
    return NextResponse.json(await getSettings(authResult.userId));
  } catch {
    console.error("[loterias/configuracoes] falha ao carregar");
    return NextResponse.json({ error: "Não foi possível carregar suas configurações." }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseSettingsInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await saveSettings(authResult.userId, parsed.value);
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[loterias/configuracoes] falha ao salvar");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
