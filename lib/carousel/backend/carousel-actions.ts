/**
 * Camada de entrada do Carrossel Inteligente para a interface: converte o
 * JSON recebido pelas rotas em chamadas dos serviços (que já validam dono,
 * limites e transições) e monta a "visão" do projeto para a tela.
 *
 * Tudo que entra aqui é NÃO confiável: cada campo é validado/limitado antes
 * de chegar ao serviço, e todo acesso é filtrado por `userId`.
 */
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import { CAROUSEL_LIMITS } from "../carousel-plans";
import { HOOK_STYLES, type HookStyle } from "../domain";
import { CAROUSEL_TEMPLATES, isCarouselTemplateId } from "../design/templates";
import { isAllowedPhotoUrl, type StockPhoto } from "../photos/photo-provider";
import {
  addCustomHook,
  attachProfileAnalysis,
  generateCarousel,
  generateProjectHooks,
  regenerateCaption,
  regenerateSlide,
  researchProject,
  type EditorialDeps,
} from "./carousel-editorial-service";
import { assignInstagramProfile, CarouselError, requireProject } from "./carousel-project-service";
import {
  chooseHook,
  listHooks,
  listSlides,
  listSources,
  updateProjectFields,
  type CarouselHookRecord,
  type CarouselProjectRecord,
  type CarouselSlideRecord,
  type CarouselSourceRecord,
} from "./carousel-repository";
import {
  addSlide,
  autoAssignPhotos,
  choosePhoto,
  deleteSlide,
  duplicateSlide,
  editSlide,
  finalizeCarousel,
  moveSlide,
  removeSlideImage,
  renderProjectSlides,
  searchPhotoOptions,
  setProjectTemplate,
  slidePhotoUrl,
  useOwnImage as applyOwnImage,
  type StudioDeps,
} from "./carousel-studio-service";
import {
  deleteCarousel,
  duplicateCarousel,
  publishCarousel,
  syncPublicationStatus,
  unscheduleCarousel,
  type PublishDeps,
  type PublishMode,
} from "./carousel-publish-service";

export type ActionDeps = EditorialDeps & StudioDeps & PublishDeps;

export interface SlideView {
  position: number;
  role: string;
  headline: string;
  body: string;
  cta: string;
  visualKind: string;
  imageQuery: string | null;
  templateId: string | null;
  align: string | null;
  /** Foto de fundo (banco de fotos ou do usuário) para a miniatura do editor. */
  photoUrl: string | null;
  /** Arte final renderizada (1080×1350), quando já existe e está atual. */
  renderedUrl: string | null;
}

export interface ProjectView {
  project: Pick<
    CarouselProjectRecord,
    "id" | "title" | "topic" | "status" | "slideCount" | "templateId" | "chosenHookId" | "caption" | "hashtags" | "includeEndMedia" | "instagramAccountId" | "instagramPostId" | "sourceKind" | "error"
  > & { completed: boolean; createdAt: string; updatedAt: string };
  slides: SlideView[];
  hooks: CarouselHookRecord[];
  sources: CarouselSourceRecord[];
  research: { summary: string | null; keyPoints: string[] };
  templates: Array<{ id: string; name: string; description: string }>;
}

async function mediaUrl(userId: string, mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null;
  const media = await getInstagramMediaById(mediaId, userId);
  return media?.storageUrl ?? null;
}

async function toSlideView(userId: string, slide: CarouselSlideRecord): Promise<SlideView> {
  const [own, rendered] = await Promise.all([mediaUrl(userId, slide.imageMediaId), mediaUrl(userId, slide.renderedMediaId)]);
  const align = slide.style.align;
  return {
    position: slide.position,
    role: slide.role,
    headline: slide.headline,
    body: slide.body,
    cta: slide.cta,
    visualKind: slide.visualKind,
    imageQuery: slide.imageQuery,
    templateId: slide.templateId,
    align: align === "left" || align === "center" ? align : null,
    photoUrl: own ?? slidePhotoUrl(slide),
    renderedUrl: rendered,
  };
}

function readResearch(project: CarouselProjectRecord): { summary: string | null; keyPoints: string[] } {
  const raw = project.research as { summary?: unknown; keyPoints?: unknown };
  const keyPoints = Array.isArray(raw.keyPoints) ? raw.keyPoints.filter((point): point is string => typeof point === "string").slice(0, 8) : [];
  return { summary: typeof raw.summary === "string" ? raw.summary.slice(0, 1200) : null, keyPoints };
}

export async function getProjectView(userId: string, projectId: string): Promise<ProjectView> {
  const project = await requireProject(userId, projectId);
  const [slides, hooks, sources] = await Promise.all([listSlides(projectId), listHooks(projectId), listSources(projectId)]);
  const slideViews = await Promise.all(slides.map((slide) => toSlideView(userId, slide)));
  return {
    project: {
      id: project.id,
      title: project.title,
      topic: project.topic,
      status: project.status,
      slideCount: project.slideCount,
      templateId: project.templateId,
      chosenHookId: project.chosenHookId,
      caption: project.caption,
      hashtags: project.hashtags,
      includeEndMedia: project.includeEndMedia,
      instagramAccountId: project.instagramAccountId,
      instagramPostId: project.instagramPostId,
      sourceKind: project.sourceKind,
      error: project.error,
      completed: project.completedAt !== null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    },
    slides: slideViews,
    hooks,
    sources,
    research: readResearch(project),
    templates: CAROUSEL_TEMPLATES.map((template) => ({ id: template.id, name: template.name, description: template.description })),
  };
}

// ---------------------------------------------------------------------------
// Validação de entrada
// ---------------------------------------------------------------------------
const invalid = (message: string): CarouselError => new CarouselError("INVALID", message);

function text(value: unknown, max: number, label: string, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw invalid(`Informe ${label}.`);
    return undefined;
  }
  if (typeof value !== "string") throw invalid(`${label} inválido.`);
  const clean = value.replace(/\r\n/g, "\n").trim().slice(0, max);
  if (required && !clean) throw invalid(`Informe ${label}.`);
  return clean;
}

function int(value: unknown, label: string, min = 1, max = 20): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw invalid(`${label} inválido.`);
  return value;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[0-9a-f-]{32,36}$/i.test(value)) throw invalid(`${label} inválido.`);
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parsePhoto(value: unknown): StockPhoto {
  const raw = asRecord(value);
  if (!isAllowedPhotoUrl(raw.url)) throw invalid("Foto não permitida.");
  const thumb = typeof raw.thumbUrl === "string" && isAllowedPhotoUrl(raw.thumbUrl) ? raw.thumbUrl : raw.url;
  return {
    provider: raw.provider === "pixabay" ? "pixabay" : "pexels",
    id: String(raw.id ?? "").slice(0, 40),
    url: raw.url,
    thumbUrl: thumb,
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
    author: String(raw.author ?? "").slice(0, 80),
    authorUrl: typeof raw.authorUrl === "string" ? raw.authorUrl.slice(0, 300) : null,
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl.slice(0, 300) : null,
  };
}

function parseHashtags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw invalid("Hashtags inválidas.");
  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 40))
    .filter(Boolean)
    .map((tag) => `#${tag}`);
  return Array.from(new Set(tags)).slice(0, CAROUSEL_LIMITS.hashtags);
}

export const PROJECT_ACTIONS = [
  "research",
  "hooks",
  "choose-hook",
  "custom-hook",
  "generate",
  "regen-slide",
  "regen-caption",
  "edit-slide",
  "set-template",
  "move-slide",
  "duplicate-slide",
  "delete-slide",
  "add-slide",
  "search-photos",
  "choose-photo",
  "own-image",
  "remove-image",
  "auto-photos",
  "render",
  "finalize",
  "publish",
  "unschedule",
  "sync",
  "set-profile",
  "update",
  "attach-analysis",
  "duplicate",
  "delete",
] as const;
export type ProjectAction = (typeof PROJECT_ACTIONS)[number];

export function isProjectAction(value: unknown): value is ProjectAction {
  return typeof value === "string" && (PROJECT_ACTIONS as readonly string[]).includes(value);
}

/** Executa UMA ação da tela sobre um projeto do usuário e devolve um resultado serializável. */
export async function runProjectAction(userId: string, projectId: string, body: Record<string, unknown>, deps: ActionDeps = {}): Promise<Record<string, unknown>> {
  const action = body.action;
  if (!isProjectAction(action)) throw invalid("Ação inválida.");

  switch (action) {
    case "research": {
      const result = await researchProject(userId, projectId, deps);
      return { ok: true, researched: result !== null };
    }
    case "hooks": {
      const styles = Array.isArray(body.styles) ? body.styles.filter((s): s is HookStyle => typeof s === "string" && (HOOK_STYLES as readonly string[]).includes(s)) : undefined;
      await generateProjectHooks(userId, projectId, styles && styles.length > 0 ? styles : undefined, deps);
      return { ok: true };
    }
    case "choose-hook": {
      const ok = await chooseHook(userId, projectId, uuid(body.hookId, "Gancho"));
      if (!ok) throw new CarouselError("NOT_FOUND", "Gancho não encontrado.");
      return { ok: true };
    }
    case "custom-hook": {
      await addCustomHook(userId, projectId, text(body.headline, CAROUSEL_LIMITS.headline, "o gancho", true) as string, text(body.subtitle, CAROUSEL_LIMITS.subtitle, "o subtítulo"));
      return { ok: true };
    }
    case "generate": {
      await generateCarousel(userId, projectId, {
        ...deps,
        refreshResearch: body.refreshResearch === true,
        extraInstruction: text(body.instruction, 300, "a instrução") ?? null,
      });
      return { ok: true };
    }
    case "regen-slide": {
      await regenerateSlide(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides), text(body.instruction, 300, "a instrução") ?? null, deps);
      return { ok: true };
    }
    case "regen-caption": {
      await regenerateCaption(userId, projectId, deps);
      return { ok: true };
    }
    case "edit-slide": {
      const edit = asRecord(body.edit);
      const align = edit.align === "left" || edit.align === "center" ? edit.align : edit.align === null ? null : undefined;
      await editSlide(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides), {
        headline: text(edit.headline, CAROUSEL_LIMITS.headline, "o título"),
        body: text(edit.body, CAROUSEL_LIMITS.body, "o texto"),
        cta: text(edit.cta, CAROUSEL_LIMITS.cta, "o CTA"),
        visualKind: typeof edit.visualKind === "string" ? edit.visualKind : undefined,
        templateId: edit.templateId === null ? null : isCarouselTemplateId(edit.templateId) ? edit.templateId : undefined,
        align,
        imageQuery: edit.imageQuery === null ? null : text(edit.imageQuery, 80, "a busca de imagem"),
      });
      return { ok: true };
    }
    case "set-template": {
      await setProjectTemplate(userId, projectId, text(body.templateId, 40, "o modelo", true) as string);
      return { ok: true };
    }
    case "move-slide": {
      await moveSlide(userId, projectId, int(body.from, "Origem", 1, CAROUSEL_LIMITS.maxSlides), int(body.to, "Destino", 1, CAROUSEL_LIMITS.maxSlides));
      return { ok: true };
    }
    case "duplicate-slide": {
      await duplicateSlide(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides));
      return { ok: true };
    }
    case "delete-slide": {
      await deleteSlide(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides));
      return { ok: true };
    }
    case "add-slide": {
      await addSlide(userId, projectId, int(body.after, "Posição", 0, CAROUSEL_LIMITS.maxSlides), {
        headline: text(body.headline, CAROUSEL_LIMITS.headline, "o título", true) as string,
        body: text(body.body, CAROUSEL_LIMITS.body, "o texto"),
      });
      return { ok: true };
    }
    case "search-photos": {
      await requireProject(userId, projectId);
      const result = await searchPhotoOptions(text(body.query, 80, "a busca", true) as string, deps);
      return { ok: true, available: result.available, photos: result.photos };
    }
    case "choose-photo": {
      await choosePhoto(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides), parsePhoto(body.photo));
      return { ok: true };
    }
    case "own-image": {
      await applyOwnImage(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides), uuid(body.mediaId, "Imagem"));
      return { ok: true };
    }
    case "remove-image": {
      await removeSlideImage(userId, projectId, int(body.position, "Slide", 1, CAROUSEL_LIMITS.maxSlides));
      return { ok: true };
    }
    case "auto-photos": {
      const result = await autoAssignPhotos(userId, projectId, deps);
      return { ok: true, result };
    }
    case "render": {
      const result = await renderProjectSlides(userId, projectId, { ...deps, force: body.force === true });
      return { ok: true, result };
    }
    case "finalize": {
      const result = await finalizeCarousel(userId, projectId, deps);
      return { ok: true, alreadyCompleted: "alreadyCompleted" in result ? Boolean((result as { alreadyCompleted?: boolean }).alreadyCompleted) : false };
    }
    case "publish": {
      const mode = body.mode;
      if (mode !== "DRAFT" && mode !== "NOW" && mode !== "SCHEDULE") throw invalid("Escolha como publicar.");
      const result = await publishCarousel(
        userId,
        projectId,
        {
          mode: mode as PublishMode,
          scheduledAt: typeof body.scheduledAt === "string" ? body.scheduledAt : null,
          timezone: typeof body.timezone === "string" ? body.timezone.slice(0, 60) : null,
          accountId: typeof body.accountId === "string" ? uuid(body.accountId, "Perfil") : null,
          caption: text(body.caption, CAROUSEL_LIMITS.caption, "a legenda"),
        },
        deps,
      );
      return { ok: true, outcome: result.outcome, postId: result.postId, notice: result.notice };
    }
    case "unschedule": {
      await unscheduleCarousel(userId, projectId);
      return { ok: true };
    }
    case "sync": {
      const project = await requireProject(userId, projectId);
      await syncPublicationStatus(userId, project);
      return { ok: true };
    }
    case "set-profile": {
      await assignInstagramProfile(userId, projectId, uuid(body.accountId, "Perfil"));
      return { ok: true };
    }
    case "update": {
      await requireProject(userId, projectId);
      const updated = await updateProjectFields(userId, projectId, {
        title: text(body.title, 120, "o título"),
        caption: text(body.caption, CAROUSEL_LIMITS.caption, "a legenda"),
        hashtags: parseHashtags(body.hashtags),
        includeEndMedia: typeof body.includeEndMedia === "boolean" ? body.includeEndMedia : undefined,
      });
      if (!updated) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
      return { ok: true };
    }
    case "attach-analysis": {
      await attachProfileAnalysis(userId, projectId, uuid(body.analysisId, "Análise"));
      return { ok: true };
    }
    case "duplicate": {
      const copy = await duplicateCarousel(userId, projectId);
      return { ok: true, projectId: copy.id };
    }
    case "delete": {
      await deleteCarousel(userId, projectId);
      return { ok: true };
    }
  }
}
