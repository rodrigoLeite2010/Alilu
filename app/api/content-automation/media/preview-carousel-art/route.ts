import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import { isPostTemplateId } from "@/lib/instagram/templates";
import {
  renderAutomationCarouselBuffers,
  TemplateRenderError,
  AUTO_TEMPLATE_OVERLAY_LEVELS,
} from "@/lib/instagram/backend/template-render-service";
import { isValidHexColor } from "@/lib/instagram/colors";
import { MAX_CAROUSEL_ITEMS } from "@/lib/instagram/backend/instagram-post-service";

/**
 * POST `{ imageMediaId, templateId, visualText, overlayOpacity, visualTextColor }`:
 * gera uma prévia do CARROSSEL do Piloto Automático (modo AUTO_TEMPLATE)
 * SEM gravar nada — nem no Blob, nem em instagram_media, nem numa
 * execução. Mesmo motor de divisão/desenho usado na geração real
 * (renderAutomationCarouselBuffers), então o preview nunca diverge do
 * resultado final — mesmo princípio de preview-art/route.ts, só que
 * devolvendo um array de imagens (um por slide) em vez de uma só.
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
  const { imageMediaId, templateId, visualText, overlayOpacity, visualTextColor } = (body as Record<string, unknown>) ?? {};

  if (typeof imageMediaId !== "string" || !imageMediaId) {
    return NextResponse.json({ error: "imageMediaId é obrigatório." }, { status: 400 });
  }
  if (typeof visualText !== "string" || !visualText.trim()) {
    return NextResponse.json({ error: "Escreva o texto do carrossel antes de pré-visualizar." }, { status: 400 });
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
  const safeVisualTextColor = visualTextColor === null || visualTextColor === undefined
    ? null
    : typeof visualTextColor === "string" && isValidHexColor(visualTextColor)
      ? visualTextColor
      : undefined;
  if (safeVisualTextColor === undefined) {
    return NextResponse.json({ error: "Cor do texto inválida." }, { status: 400 });
  }

  const media = await getInstagramMediaById(imageMediaId, userId);
  if (!media || media.mediaType !== "image") {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  try {
    const { slides, overflowText } = await renderAutomationCarouselBuffers({
      templateId: safeTemplateId,
      styleConfig: null,
      sourceImageUrl: media.storageUrl,
      visualText: visualText.trim(),
      overlayOpacity: safeOverlayOpacity,
      visualTextColor: safeVisualTextColor,
      maxSlides: MAX_CAROUSEL_ITEMS,
    });
    return NextResponse.json(
      {
        slides: slides.map((slide) => ({
          dataUrl: `data:${slide.contentType};base64,${slide.buffer.toString("base64")}`,
          text: slide.text,
        })),
        overflowText,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[content-automation/media/preview-carousel-art] falha ao renderizar prévia", error);
    const message = error instanceof TemplateRenderError ? error.message : "Não foi possível gerar a prévia do carrossel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
