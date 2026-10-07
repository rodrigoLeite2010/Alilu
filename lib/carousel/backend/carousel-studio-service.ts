import "server-only";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import { CAROUSEL_LIMITS } from "../carousel-plans";
import { isCarouselTemplateId } from "../design/templates";
import { isVisualKind, maxGeneratedSlides, normalizeSlideText, slideRolesFor, type VisualKind } from "../domain";
import { createPhotoProviderFromEnv, isAllowedPhotoUrl, normalizePhotoQuery, type PhotoProvider, type StockPhoto } from "../photos/photo-provider";
import { renderAndStoreCarouselSlide, type RenderSlideInput } from "../render/carousel-render-service";
import { CarouselError, completeCarouselProject, requireProject, type CompleteProjectResult } from "./carousel-project-service";
import {
  clearRenderedSlides,
  getCarouselBrand,
  getUserEmail,
  listSlides,
  patchSlide,
  replaceSlides,
  setSlideMedia,
  updateProjectFields,
  type CarouselProjectRecord,
  type CarouselSlideRecord,
  type ReplacementSlide,
  type SlidePatch,
} from "./carousel-repository";

export interface StudioDeps {
  photos?: PhotoProvider | null;
  /** Injetável nos testes (o render real usa canvas + Vercel Blob). */
  renderSlide?: (userId: string, input: RenderSlideInput) => Promise<{ mediaId: string; url: string; warnings: string[]; photoMissing: boolean }>;
  now?: Date;
}

const photosFrom = (deps: StudioDeps): PhotoProvider | null => (deps.photos === undefined ? createPhotoProviderFromEnv() : deps.photos);

// ---------------------------------------------------------------------------
// Edição de texto e estilo
// ---------------------------------------------------------------------------
export interface SlideEdit {
  headline?: string;
  body?: string;
  cta?: string;
  visualKind?: string;
  templateId?: string | null;
  align?: "left" | "center" | null;
  imageQuery?: string | null;
}

async function requireSlide(userId: string, projectId: string, position: number): Promise<{ project: CarouselProjectRecord; slides: CarouselSlideRecord[]; slide: CarouselSlideRecord }> {
  const project = await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  const slide = slides.find((item) => item.position === position);
  if (!slide) throw new CarouselError("NOT_FOUND", "Slide não encontrado.");
  return { project, slides, slide };
}

export async function editSlide(userId: string, projectId: string, position: number, edit: SlideEdit): Promise<CarouselSlideRecord> {
  const { slide } = await requireSlide(userId, projectId, position);
  const patch: SlidePatch = {};
  if (edit.headline !== undefined || edit.body !== undefined || edit.cta !== undefined) {
    const text = normalizeSlideText({ headline: edit.headline ?? slide.headline, body: edit.body ?? slide.body, cta: edit.cta ?? slide.cta });
    if (!text.headline) throw new CarouselError("INVALID", "O slide precisa de um título.");
    patch.headline = text.headline;
    patch.body = text.body;
    patch.cta = text.cta;
  }
  if (edit.visualKind !== undefined) {
    if (!isVisualKind(edit.visualKind) || edit.visualKind === "IMAGE_AI") throw new CarouselError("INVALID", "Tipo de visual inválido.");
    patch.visualKind = edit.visualKind;
  }
  if (edit.templateId !== undefined) {
    if (edit.templateId !== null && !isCarouselTemplateId(edit.templateId)) throw new CarouselError("INVALID", "Template inválido.");
    patch.templateId = edit.templateId;
  }
  if (edit.imageQuery !== undefined) patch.imageQuery = edit.imageQuery ? normalizePhotoQuery(edit.imageQuery) || null : null;
  if (edit.align !== undefined) {
    const style = { ...slide.style };
    if (edit.align) style.align = edit.align;
    else delete style.align;
    patch.style = style;
  }
  const updated = await patchSlide(projectId, position, patch, true);
  if (!updated) throw new CarouselError("NOT_FOUND", "Slide não encontrado.");
  return updated;
}

/** Template do carrossel inteiro (todas as artes precisam ser refeitas). */
export async function setProjectTemplate(userId: string, projectId: string, templateId: string): Promise<CarouselProjectRecord> {
  await requireProject(userId, projectId);
  if (!isCarouselTemplateId(templateId)) throw new CarouselError("INVALID", "Template inválido.");
  const updated = await updateProjectFields(userId, projectId, { templateId });
  if (!updated) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
  await clearRenderedSlides(projectId);
  return updated;
}

// ---------------------------------------------------------------------------
// Estrutura: ordem, duplicar, remover, adicionar
// ---------------------------------------------------------------------------
function toReplacement(slide: CarouselSlideRecord, position: number, role: string, keepRender: boolean): ReplacementSlide {
  return {
    position,
    role,
    headline: slide.headline,
    body: slide.body,
    cta: slide.cta,
    visualKind: slide.visualKind,
    imageQuery: slide.imageQuery,
    imageMediaId: slide.imageMediaId,
    renderedMediaId: keepRender ? slide.renderedMediaId : null,
    templateId: slide.templateId,
    style: slide.style,
  };
}

async function applyStructure(project: CarouselProjectRecord, ordered: Array<{ slide: CarouselSlideRecord; keepRender: boolean }>): Promise<CarouselSlideRecord[]> {
  const max = maxGeneratedSlides(project.includeEndMedia);
  if (ordered.length < CAROUSEL_LIMITS.minSlides) throw new CarouselError("INVALID", `O carrossel precisa ter no mínimo ${CAROUSEL_LIMITS.minSlides} slides.`);
  if (ordered.length > max) {
    throw new CarouselError("INVALID", project.includeEndMedia ? `Com a imagem final padrão, o carrossel pode ter até ${max} slides (o Instagram aceita 10 itens).` : `O carrossel pode ter até ${max} slides.`);
  }
  const roles = slideRolesFor(ordered.length);
  // Papel mudou de posição → o número/progresso da arte também: re-renderizar todas é o caminho seguro.
  const replaced = await replaceSlides(
    project.id,
    ordered.map((entry, index) => toReplacement(entry.slide, index + 1, roles[index], false)),
  );
  await updateProjectFields(project.userId, project.id, { slideCount: ordered.length });
  return replaced;
}

export async function moveSlide(userId: string, projectId: string, from: number, to: number): Promise<CarouselSlideRecord[]> {
  const { project, slides } = await requireSlide(userId, projectId, from);
  if (!Number.isInteger(to) || to < 1 || to > slides.length) throw new CarouselError("INVALID", "Posição de destino inválida.");
  const list = [...slides];
  const [moved] = list.splice(from - 1, 1);
  list.splice(to - 1, 0, moved);
  return applyStructure(project, list.map((slide) => ({ slide, keepRender: false })));
}

export async function duplicateSlide(userId: string, projectId: string, position: number): Promise<CarouselSlideRecord[]> {
  const { project, slides, slide } = await requireSlide(userId, projectId, position);
  const list = [...slides];
  list.splice(position, 0, { ...slide });
  return applyStructure(project, list.map((item) => ({ slide: item, keepRender: false })));
}

export async function deleteSlide(userId: string, projectId: string, position: number): Promise<CarouselSlideRecord[]> {
  const { project, slides } = await requireSlide(userId, projectId, position);
  if (position === 1) throw new CarouselError("INVALID", "O primeiro slide (capa) não pode ser removido; edite-o ou troque o gancho.");
  const list = slides.filter((slide) => slide.position !== position);
  return applyStructure(project, list.map((slide) => ({ slide, keepRender: false })));
}

export async function addSlide(userId: string, projectId: string, afterPosition: number, content: { headline: string; body?: string }): Promise<CarouselSlideRecord[]> {
  const { project, slides } = await requireSlide(userId, projectId, afterPosition);
  const text = normalizeSlideText({ headline: content.headline, body: content.body ?? "", cta: "" });
  if (!text.headline) throw new CarouselError("INVALID", "O novo slide precisa de um título.");
  const fresh: CarouselSlideRecord = { ...slides[afterPosition - 1], id: "new", headline: text.headline, body: text.body, cta: "", visualKind: "GRAPHIC", imageQuery: null, imageMediaId: null, renderedMediaId: null, templateId: null, style: {} };
  const list = [...slides];
  list.splice(afterPosition, 0, fresh);
  return applyStructure(project, list.map((slide) => ({ slide, keepRender: false })));
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
export async function searchPhotoOptions(query: string, deps: StudioDeps = {}): Promise<{ available: boolean; photos: StockPhoto[] }> {
  const provider = photosFrom(deps);
  if (!provider) return { available: false, photos: [] };
  return { available: true, photos: await provider.search(query, { limit: 12 }) };
}

function photoStyle(slide: CarouselSlideRecord, photo: StockPhoto | null): Record<string, unknown> {
  const style = { ...slide.style };
  if (photo) style.photo = { provider: photo.provider, id: photo.id, url: photo.url, author: photo.author, authorUrl: photo.authorUrl, sourceUrl: photo.sourceUrl };
  else delete style.photo;
  return style;
}

export function slidePhotoUrl(slide: CarouselSlideRecord): string | null {
  const photo = slide.style.photo as { url?: unknown } | undefined;
  return photo && isAllowedPhotoUrl(photo.url) ? photo.url : null;
}

/** Escolhe uma foto do banco para o slide (a URL precisa ser de um host permitido). */
export async function choosePhoto(userId: string, projectId: string, position: number, photo: StockPhoto): Promise<CarouselSlideRecord> {
  const { slide } = await requireSlide(userId, projectId, position);
  if (!isAllowedPhotoUrl(photo.url) || typeof photo.id !== "string" || !photo.id) throw new CarouselError("INVALID", "Foto inválida.");
  const updated = await patchSlide(projectId, position, { visualKind: "PHOTO", imageMediaId: null, style: photoStyle(slide, photo) }, true);
  if (!updated) throw new CarouselError("NOT_FOUND", "Slide não encontrado.");
  return updated;
}

/** Usa uma imagem que o usuário já enviou para a biblioteca dele. */
export async function useOwnImage(userId: string, projectId: string, position: number, mediaId: string): Promise<CarouselSlideRecord> {
  await requireSlide(userId, projectId, position);
  const media = await getInstagramMediaById(mediaId, userId);
  if (!media || media.mediaType !== "image") throw new CarouselError("INVALID", "Imagem não encontrada na sua biblioteca.");
  const updated = await patchSlide(projectId, position, { visualKind: "PHOTO", imageMediaId: media.id }, true);
  if (!updated) throw new CarouselError("NOT_FOUND", "Slide não encontrado.");
  return updated;
}

export async function removeSlideImage(userId: string, projectId: string, position: number): Promise<CarouselSlideRecord> {
  const { slide } = await requireSlide(userId, projectId, position);
  const updated = await patchSlide(projectId, position, { visualKind: "GRAPHIC", imageMediaId: null, style: photoStyle(slide, null) }, true);
  if (!updated) throw new CarouselError("NOT_FOUND", "Slide não encontrado.");
  return updated;
}

export interface AutoPhotoResult {
  assigned: number;
  /** Slides PHOTO que ficaram sem foto (sem provedor, sem resultado). Renderizam só com o template. */
  missing: number[];
  providerAvailable: boolean;
}

/** Procura foto para cada slide PHOTO sem imagem, sem repetir foto no carrossel. */
export async function autoAssignPhotos(userId: string, projectId: string, deps: StudioDeps = {}): Promise<AutoPhotoResult> {
  await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  const provider = photosFrom(deps);
  const without = slides.filter((slide) => !slide.imageMediaId && !slidePhotoUrl(slide));
  // Prioriza os slides marcados para foto; se nenhum foi marcado, o usuário pediu fotos, então preenche todos.
  const marked = without.filter((slide) => slide.visualKind === "PHOTO");
  const wanting = marked.length > 0 ? marked : without;
  if (!provider) return { assigned: 0, missing: wanting.map((slide) => slide.position), providerAvailable: false };
  const used = new Set(slides.map((slide) => (slide.style.photo as { id?: string } | undefined)?.id).filter(Boolean) as string[]);
  let assigned = 0;
  const missing: number[] = [];
  for (const slide of wanting) {
    const query = slide.imageQuery ?? slide.headline;
    const results = await provider.search(query, { limit: 8 });
    const pick = results.find((photo) => !used.has(photo.id));
    if (!pick) {
      missing.push(slide.position);
      continue;
    }
    used.add(pick.id);
    await patchSlide(projectId, slide.position, { style: photoStyle(slide, pick) }, true);
    assigned += 1;
  }
  return { assigned, missing, providerAvailable: true };
}

// ---------------------------------------------------------------------------
// Render e conclusão
// ---------------------------------------------------------------------------
async function resolveBrandForRender(userId: string): Promise<RenderSlideInput["brand"]> {
  const [brand, email] = await Promise.all([getCarouselBrand(userId), getUserEmail(userId)]);
  const isAlilu = isAdminEmail(email);
  return {
    handle: brand?.handle ?? (isAlilu ? "@alilu.tec" : null),
    accentColor: brand?.accentColor ?? null,
    logoUrl: brand?.logoUrl ?? null,
    useAliluLogo: isAlilu && !brand?.logoUrl,
  };
}

export interface RenderProjectResult {
  rendered: number;
  skipped: number;
  warnings: string[];
  /** Posições cuja foto não pôde ser carregada (desenhadas só com o template). */
  photoMissing: number[];
}

/** Renderiza os slides que ainda não têm arte atual (ou todos, com `force`). */
export async function renderProjectSlides(userId: string, projectId: string, options: { force?: boolean } & StudioDeps = {}): Promise<RenderProjectResult> {
  const project = await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  if (slides.length === 0) throw new CarouselError("INCOMPLETE", "Gere o roteiro antes de renderizar.");
  const brand = await resolveBrandForRender(userId);
  const render = options.renderSlide ?? (async (uid: string, input: RenderSlideInput) => renderAndStoreCarouselSlide(uid, input));
  const result: RenderProjectResult = { rendered: 0, skipped: 0, warnings: [], photoMissing: [] };
  for (const slide of slides) {
    if (slide.renderedMediaId && !options.force) {
      result.skipped += 1;
      continue;
    }
    let photoUrl = slidePhotoUrl(slide);
    if (slide.imageMediaId) photoUrl = (await getInstagramMediaById(slide.imageMediaId, userId))?.storageUrl ?? photoUrl;
    const align = slide.style.align === "center" || slide.style.align === "left" ? slide.style.align : undefined;
    const out = await render(userId, {
      position: slide.position,
      total: slides.length,
      headline: slide.headline,
      body: slide.body,
      cta: slide.cta,
      templateId: slide.templateId ?? project.templateId,
      photoUrl,
      align,
      brand,
    });
    await setSlideMedia(projectId, slide.position, { renderedMediaId: out.mediaId });
    result.rendered += 1;
    result.warnings.push(...out.warnings.map((warning) => `Slide ${slide.position}: ${warning}`));
    if (out.photoMissing) result.photoMissing.push(slide.position);
  }
  return result;
}

/**
 * Finaliza o carrossel: gera as artes que faltam e CONCLUI (consome UMA
 * cota, idempotente). Se qualquer render falhar, nada é cobrado.
 */
export async function finalizeCarousel(userId: string, projectId: string, deps: StudioDeps = {}): Promise<CompleteProjectResult & { render: RenderProjectResult }> {
  const render = await renderProjectSlides(userId, projectId, deps);
  const completed = await completeCarouselProject(userId, projectId, deps.now);
  return { ...completed, render };
}

export type { VisualKind };
