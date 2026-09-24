import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AIProviderConfigError } from "@/lib/content-automation/backend/ai-provider";
import { getContentAIProvider } from "@/lib/content-automation/backend/provider-factory";
import { composeCaption } from "@/lib/content-automation/backend/compose-caption";

const MAX_PROMPT_LENGTH = 2000;

/**
 * Geração AVULSA de legenda com IA para o compositor manual (Agendador) —
 * reaproveita o MESMO provedor de IA do Piloto Automático
 * (getContentAIProvider(), lib/content-automation/backend/provider-factory.ts)
 * e a MESMA montagem de legenda final (composeCaption), nunca uma segunda
 * implementação. Diferente do Piloto Automático: não cria nenhuma
 * automação/execução, não grava em automation_runs nem em
 * generation_usage (essa tabela exige automation_id) — é só uma sugestão
 * pontual que o usuário revisa e edita antes de agendar, exatamente como
 * preencheria a legenda manualmente.
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

  const { prompt } = body as { prompt?: unknown };
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "Descreva o que a legenda deve falar." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `O prompt não pode passar de ${MAX_PROMPT_LENGTH} caracteres.` },
      { status: 400 },
    );
  }

  try {
    const provider = getContentAIProvider();
    const { content } = await provider.generatePost({
      brandContext: "",
      dayPrompt: prompt.trim(),
      avoidTopics: [],
    });
    const caption = composeCaption(content.caption, content.cta, content.hashtags);
    return NextResponse.json({ caption, title: content.title, hashtags: content.hashtags });
  } catch (error) {
    if (error instanceof AIProviderConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[instagram/ai-caption] falha ao gerar legenda", error);
    return NextResponse.json({ error: "Não foi possível gerar a legenda com IA agora. Tente novamente." }, { status: 500 });
  }
}
