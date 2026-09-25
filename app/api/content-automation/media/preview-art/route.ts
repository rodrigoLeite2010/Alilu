import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import { isPostTemplateId } from "@/lib/instagram/templates";
import {
  renderAutomationArtBuffer,
  TemplateRenderError,
  AUTO_TEMPLATE_OVERLAY_LEVELS,
} from "@/lib/instagram/backend/template-render-service";

/**
 * POST `{ imageMediaId, templateId, visualText, overlayOpacity }`: gera
 * uma prévia da arte do Piloto Automático (modo AUTO_TEMPLATE) SEM
 * gravar nada — nem no Blob, nem em instagram_media, nem numa execução.
 * Chama exatamente o mesmo motor de desenho usado na geração real
 * (renderAutomationArtBuffer), então o preview nunca diverge do
 * resultado final (Parte 8 do briefing: "o preview deve representar
 * fielmente o resultado final"). Usado tanto no assistente de criação
 * (automação ainda não existe) quanto na edição — por isso não depende
 * de um automationId, só da posse da imagem.
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
  const { imageMediaId, templateId, visualText, overlayOpacity } = (body as Record<string, unknown>) ?? {};

  if (typeof imageMediaId !== "string" || !imageMediaId) {
    return NextResponse.json({ error: "imageMediaId é obrigatório." }, { status: 400 });
  }
  if (typeof visualText !== "string" || !visualText.trim()) {
    return NextResponse.json({ error: "Escreva o texto que vai sobre a imagem antes de pré-visualizar." }, { status: 400 });
  }
  const safeTemplateId = templateId === null || templateId === undefined
    ? null
    : typeof templateId === "string" && isPostTemplateId(templateId)
      ? templateId
      : undefined;
  if (safeTemplateId === undefined) {
    return NextResponse.json({ error: "Template inválido." }, { status: 400 });
  }
  const safeOverlayOpacity = overlayOpacity === null || overlayOpacity === undefined
    ? null
    : typeof overlayOpacity === "number" && (AUTO_TEMPLATE_OVERLAY_LEVELS as readonly number[]).includes(overlayOpacity)
      ? overlayOpacity
      : undefined;
  if (safeOverlayOpacity === undefined) {
    return NextResponse.json({ error: "Nível de véu inválido." }, { status: 400 });
  }

  const media = await getInstagramMediaById(imageMediaId, userId);
  if (!media || media.mediaType !== "image") {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await renderAutomationArtBuffer({
      templateId: safeTemplateId,
      styleConfig: null,
      sourceImageUrl: media.storageUrl,
      visualText: visualText.trim(),
      overlayOpacity: safeOverlayOpacity,
    });
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ dataUrl });
  } catch (error) {
    console.error("[content-automation/media/preview-art] falha ao renderizar prévia", error);
    const message = error instanceof TemplateRenderError ? error.message : "Não foi possível gerar a prévia da arte.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
