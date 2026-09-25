import { NextResponse } from "next/server";
import { createSuggestion, sanitizeSuggestionMessage } from "@/lib/suggestions/suggestion-repository";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { message, pagePath } = body as { message?: unknown; pagePath?: unknown };
  const cleanMessage = sanitizeSuggestionMessage(message);
  if (cleanMessage.length < 3) {
    return NextResponse.json(
      { error: "Conte um pouco mais sobre a ferramenta que você gostaria." },
      { status: 400 },
    );
  }

  try {
    const id = await createSuggestion({
      message: cleanMessage,
      pagePath: typeof pagePath === "string" ? pagePath : null,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("[suggestions] falha ao salvar sugestão", error);
    return NextResponse.json({ error: "Não foi possível salvar sua sugestão agora." }, { status: 500 });
  }
}
