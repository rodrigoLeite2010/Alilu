import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import {
  renderAutomationArtBuffer,
  TemplateRenderError,
  AUTO_TEMPLATE_OVERLAY_LEVELS,
} from "@/lib/instagram/backend/template-render-service";
import { isValidHexColor } from "@/lib/instagram/colors";
import { getContentAIProvider } from "@/lib/content-automation/backend/provider-factory";
import { canUseAutomation } from "@/lib/billing/backend/automation-access-service";
import {
  CONTENT_CATEGORIES,
  CONTENT_CATEGORY_LABEL,
  DAY_OF_WEEK_LABEL,
  DAYS_OF_WEEK,
  MAX_VISUAL_TEXT_LENGTH,
  type AutomationContentCategory,
  type DayOfWeek,
} from "@/lib/content-automation/backend/automation-types";
import { applyPromptVariables, displaySiteUrl } from "@/lib/content-automation/prompt-variables";

export const maxDuration = 60;

/**
 * POST — "Gerar prévia" de um Story do Piloto Automático, SEM publicar e
 * SEM gravar nada (nem Blob, nem instagram_media, nem execução):
 *
 *   { imageMediaId, mode: "MANUAL", visualText?, overlayOpacity?, visualTextColor?, ... }
 *   { imageMediaId, mode: "AI", prompt, dayOfWeek, brandContext?, ... }
 *
 * No modo "AI" executa o prompt de verdade (mesmo provedor e mesmas
 * variáveis {{…}} da geração real) para mostrar o texto que sairia — só
 * para quem pode usar o Piloto Automático agora (trial ativo ou
 * assinatura), mas sem consumir nenhum dos usos do dia. A arte sai do
 * MESMO motor da geração real (renderAutomationArtBuffer, formato
 * "stories" 1080×1920), então a prévia nunca diverge do Story publicado.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { imageMediaId, mode, visualText, prompt, dayOfWeek, brandContext, overlayOpacity, visualTextColor, instagramAccountId, automationName, contentCategory, publishTime } = body;

  if (typeof imageMediaId !== "string" || !imageMediaId) {
    return NextResponse.json({ error: "Escolha uma imagem de fundo para pré-visualizar o Story." }, { status: 400 });
  }
  const safeOverlayOpacity =
    overlayOpacity === null || overlayOpacity === undefined
      ? null
      : typeof overlayOpacity === "number" && (AUTO_TEMPLATE_OVERLAY_LEVELS as readonly number[]).includes(overlayOpacity)
        ? overlayOpacity
        : undefined;
  if (safeOverlayOpacity === undefined) {
    return NextResponse.json({ error: "Nível de véu inválido." }, { status: 400 });
  }
  const safeVisualTextColor =
    visualTextColor === null || visualTextColor === undefined
      ? null
      : typeof visualTextColor === "string" && isValidHexColor(visualTextColor)
        ? visualTextColor
        : undefined;
  if (safeVisualTextColor === undefined) {
    return NextResponse.json({ error: "Cor do texto inválida." }, { status: 400 });
  }
  const dow = typeof dayOfWeek === "string" && DAYS_OF_WEEK.includes(dayOfWeek as DayOfWeek) ? (dayOfWeek as DayOfWeek) : "MONDAY";
  const category =
    typeof contentCategory === "string" && CONTENT_CATEGORIES.includes(contentCategory as AutomationContentCategory)
      ? (contentCategory as AutomationContentCategory)
      : null;

  const media = await getInstagramMediaById(imageMediaId, userId);
  if (!media || media.mediaType !== "image") {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  const account =
    typeof instagramAccountId === "string" && instagramAccountId
      ? await getInstagramAccountByIdForUser(instagramAccountId, userId)
      : null;
  const variables = {
    diaSemana: DAY_OF_WEEK_LABEL[dow],
    runDate: new Date().toISOString().slice(0, 10),
    hora: typeof publishTime === "string" ? publishTime : "",
    nomeConta: account?.igUsername ?? null,
    tema: typeof automationName === "string" ? automationName : "",
    categoria: category ? CONTENT_CATEGORY_LABEL[category] : null,
    urlSite: displaySiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  };

  let text = "";
  if (mode === "AI") {
    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Escreva o prompt do Story antes de gerar a prévia." }, { status: 400 });
    }
    const access = await canUseAutomation(userId);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason ?? "A prévia com IA está disponível durante o teste ou com a assinatura ativa." },
        { status: 403 },
      );
    }
    try {
      const provider = getContentAIProvider();
      const { content } = await provider.generatePost({
        brandContext: typeof brandContext === "string" ? brandContext : "",
        dayPrompt: applyPromptVariables(prompt.trim(), variables),
        dayOfWeekLabel: DAY_OF_WEEK_LABEL[dow],
        avoidTopics: [],
        includeVisualText: true,
        visualTextMode: "STORY",
      });
      text = content.visualText?.trim() ?? "";
    } catch (error) {
      console.error("[content-automation/media/preview-story] falha ao gerar texto com IA", error);
      return NextResponse.json({ error: "Não foi possível gerar o texto com a IA agora. Tente novamente." }, { status: 502 });
    }
    if (!text) {
      return NextResponse.json({ error: "A IA não devolveu um texto para o Story. Tente de novo ou ajuste o prompt." }, { status: 502 });
    }
  } else {
    text = typeof visualText === "string" ? applyPromptVariables(visualText.trim(), variables) : "";
    if (text.length > MAX_VISUAL_TEXT_LENGTH) {
      return NextResponse.json({ error: `O texto do Story pode ter no máximo ${MAX_VISUAL_TEXT_LENGTH} caracteres.` }, { status: 400 });
    }
  }

  try {
    const { buffer, contentType, finalWidth, finalHeight } = await renderAutomationArtBuffer({
      formatId: "stories",
      templateId: null,
      styleConfig: null,
      sourceImageUrl: media.storageUrl,
      visualText: text,
      overlayOpacity: text ? safeOverlayOpacity : 0,
      visualTextColor: safeVisualTextColor,
    });
    return NextResponse.json(
      {
        dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
        visualText: text,
        meta: { finalWidth, finalHeight, fileSizeBytes: buffer.byteLength },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[content-automation/media/preview-story] falha ao renderizar prévia", error);
    const message = error instanceof TemplateRenderError ? error.message : "Não foi possível gerar a prévia do Story.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
