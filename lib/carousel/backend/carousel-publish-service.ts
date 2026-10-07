import "server-only";
import JSZip from "jszip";
import { resolveUploadedMediaId } from "@/lib/instagram/backend/instagram-post-service";
import { parseScheduledAt, InstagramPostValidationError } from "@/lib/instagram/backend/instagram-post-service";
import { getInstagramAccountByIdForUser, listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { getInstagramMediaById } from "@/lib/instagram/backend/media-repository";
import { createDraftCarouselPost, getPostStatusForUser, type InstagramPostStatus } from "@/lib/instagram/backend/instagram-post-repository";
import { deletePost } from "@/lib/instagram/backend/instagram-post-service";
import { InstagramPublishError, publishPost, type PublishOutcome } from "@/lib/instagram/backend/instagram-publish-service";
import { EndMediaValidationError, resolveCarouselEndForPost } from "@/lib/brand-end-media/backend/end-media-service";
import { markPostEndMedia, recordEndMediaEvent } from "@/lib/brand-end-media/backend/end-media-repository";
import { CAROUSEL_LIMITS } from "../carousel-plans";
import { slidePhotoUrl, finalizeCarousel, type StudioDeps } from "./carousel-studio-service";
import { assignInstagramProfile, CarouselError, changeProjectStatus, requireProject } from "./carousel-project-service";
import {
  deleteProject,
  getProject,
  insertProject,
  listProjects,
  listSlides,
  replaceSlides,
  setProjectResearch,
  setProjectStatus,
  updateProjectFields,
  type CarouselProjectRecord,
  type CarouselSlideRecord,
} from "./carousel-repository";
import type { CarouselProjectStatus } from "../domain";

export type PublishMode = "DRAFT" | "NOW" | "SCHEDULE";

export interface PublishCarouselInput {
  mode: PublishMode;
  scheduledAt?: string | null;
  timezone?: string | null;
  /** Perfil de destino (se o projeto ainda não tem um). */
  accountId?: string | null;
  caption?: string;
}

export interface PublishCarouselResult {
  project: CarouselProjectRecord;
  postId: string;
  outcome: PublishOutcome | "SAVED_AS_DRAFT" | "SCHEDULED";
  /** Aviso não bloqueante (ex.: imagem final padrão não configurada). */
  notice: string | null;
}

export interface PublishDeps extends StudioDeps {
  publish?: (postId: string, userId: string) => Promise<PublishOutcome>;
}

const ACTIVE_POST_STATUSES: InstagramPostStatus[] = ["PUBLISHED", "PROCESSING"];

async function pickAccountId(userId: string, project: CarouselProjectRecord, requested: string | null | undefined, now: Date): Promise<string> {
  if (project.instagramAccountId && !requested) return project.instagramAccountId;
  if (requested) {
    await assignInstagramProfile(userId, project.id, requested, now);
    return requested;
  }
  const accounts = (await listInstagramAccountsForUser(userId)).filter((account) => account.status === "connected");
  if (accounts.length === 0) throw new CarouselError("INVALID", "Conecte uma conta do Instagram para publicar ou agendar.");
  if (accounts.length > 1) throw new CarouselError("INVALID", "Escolha em qual perfil do Instagram publicar.");
  await assignInstagramProfile(userId, project.id, accounts[0].id, now);
  return accounts[0].id;
}

/**
 * Publica, agenda ou salva como rascunho o carrossel na camada de publicação
 * existente (instagram_posts). Antes disso garante que as artes estão
 * atuais e que o carrossel está concluído (cota consumida UMA vez).
 * Nunca cria um segundo post enquanto o primeiro está publicado/em processamento.
 */
export async function publishCarousel(userId: string, projectId: string, input: PublishCarouselInput, deps: PublishDeps = {}): Promise<PublishCarouselResult> {
  const now = deps.now ?? new Date();
  let project = await requireProject(userId, projectId);

  if (project.instagramPostId) {
    const status = await getPostStatusForUser(project.instagramPostId, userId);
    if (status && ACTIVE_POST_STATUSES.includes(status)) {
      throw new CarouselError("BAD_TRANSITION", status === "PUBLISHED" ? "Este carrossel já foi publicado." : "Este carrossel já está sendo publicado.");
    }
  }
  if (input.mode === "SCHEDULE" && !input.scheduledAt) throw new CarouselError("INVALID", "Escolha a data e a hora do agendamento.");

  let scheduledAtUtc: Date | null = null;
  try {
    scheduledAtUtc = input.mode === "SCHEDULE" ? parseScheduledAt(input.scheduledAt) : null;
  } catch (error) {
    if (error instanceof InstagramPostValidationError) throw new CarouselError("INVALID", error.message);
    throw error;
  }

  const accountId = await pickAccountId(userId, project, input.accountId, now);
  const account = await getInstagramAccountByIdForUser(accountId, userId);
  if (!account || account.status !== "connected") throw new CarouselError("INVALID", "A conta do Instagram deste carrossel não está conectada. Reconecte para publicar.");

  if (input.caption !== undefined) {
    const caption = input.caption.trim().slice(0, CAROUSEL_LIMITS.caption);
    project = (await updateProjectFields(userId, projectId, { caption })) ?? project;
  }

  // Artes atuais + conclusão (cota). Falhou? Nada foi criado nem cobrado.
  await finalizeCarousel(userId, projectId, deps);
  const slides = await listSlides(projectId);
  const mediaIds = slides.map((slide) => slide.renderedMediaId);
  if (mediaIds.some((id) => !id)) throw new CarouselError("INCOMPLETE", "Alguma arte não foi gerada. Tente novamente.");

  // Imagem final padrão: sempre como último item, copiada no momento de publicar.
  let endResolution: Awaited<ReturnType<typeof resolveCarouselEndForPost>>;
  try {
    endResolution = await resolveCarouselEndForPost(userId, project.includeEndMedia ? { mode: "default" } : { mode: "none" }, mediaIds.length, (url) => resolveUploadedMediaId(url, userId));
  } catch (error) {
    if (error instanceof EndMediaValidationError) throw new CarouselError("INVALID", error.message);
    throw error;
  }
  const endItem = endResolution.item;

  // Recria o post (conteúdo sempre atual): descarta rascunho/agendamento anterior.
  if (project.instagramPostId) {
    try {
      await deletePost(project.instagramPostId, userId);
    } catch {
      // post já removido ou em processamento: a trava acima cobre o caso de publicado
    }
  }
  const finalProject = await requireProject(userId, projectId);
  const postId = await createDraftCarouselPost({
    userId,
    instagramAccountId: accountId,
    mediaIds: endItem ? [...(mediaIds as string[]), endItem.mediaId] : (mediaIds as string[]),
    caption: finalProject.caption,
    scheduledAtUtc,
    timezone: input.timezone ?? undefined,
  });
  if (endItem || endResolution.notApplied) {
    await markPostEndMedia(postId, userId, { applied: Boolean(endItem), type: endItem ? "IMAGE" : null, urlUsed: endItem?.urlUsed ?? null, error: endResolution.notApplied });
    await recordEndMediaEvent({ userId, postId, context: "CAROUSEL", mediaType: "IMAGE", assetId: endItem?.sourceAssetId ?? null, applied: Boolean(endItem), error: endResolution.notApplied });
  }
  await linkPost(userId, projectId, postId);

  if (input.mode === "DRAFT") {
    return { project: await requireProject(userId, projectId), postId, outcome: "SAVED_AS_DRAFT", notice: endResolution.notApplied };
  }
  if (input.mode === "SCHEDULE") {
    const scheduled = await changeProjectStatus(userId, projectId, "SCHEDULED", { instagramPostId: postId });
    return { project: scheduled, postId, outcome: "SCHEDULED", notice: endResolution.notApplied };
  }

  try {
    const outcome = await (deps.publish ?? publishPost)(postId, userId);
    const next: CarouselProjectStatus = outcome === "PUBLISHED" ? "PUBLISHED" : "SCHEDULED";
    const updated = await changeProjectStatus(userId, projectId, next, { instagramPostId: postId });
    return { project: updated, postId, outcome, notice: endResolution.notApplied };
  } catch (error) {
    const message = error instanceof InstagramPublishError ? error.message : "Não foi possível publicar agora. Tente novamente em instantes.";
    await setProjectStatus(userId, projectId, "READY", { error: message, instagramPostId: postId });
    throw new CarouselError("INVALID", message);
  }
}

async function linkPost(userId: string, projectId: string, postId: string): Promise<void> {
  await setProjectStatus(userId, projectId, (await requireProject(userId, projectId)).status, { instagramPostId: postId, error: null });
}

/** Cancela um agendamento: o post sai da fila e o carrossel volta a "pronto". */
export async function unscheduleCarousel(userId: string, projectId: string): Promise<CarouselProjectRecord> {
  const project = await requireProject(userId, projectId);
  if (!project.instagramPostId || project.status !== "SCHEDULED") throw new CarouselError("BAD_TRANSITION", "Este carrossel não está agendado.");
  const status = await getPostStatusForUser(project.instagramPostId, userId);
  if (status && ACTIVE_POST_STATUSES.includes(status)) throw new CarouselError("BAD_TRANSITION", "Este carrossel já está sendo publicado.");
  try {
    await deletePost(project.instagramPostId, userId);
  } catch {
    // já não existe
  }
  await setProjectStatus(userId, projectId, "READY", { instagramPostId: null, error: null });
  return requireProject(userId, projectId);
}

/** Alinha o status do projeto ao do post (o agendador publica sozinho em segundo plano). */
export async function syncPublicationStatus(userId: string, project: CarouselProjectRecord): Promise<CarouselProjectRecord> {
  if (!project.instagramPostId || (project.status !== "SCHEDULED" && project.status !== "READY")) return project;
  const status = await getPostStatusForUser(project.instagramPostId, userId);
  if (status === "PUBLISHED") return (await setProjectStatus(userId, project.id, "PUBLISHED")) ?? project;
  if (status === "FAILED" && project.status === "SCHEDULED") return (await setProjectStatus(userId, project.id, "READY", { error: "A publicação agendada falhou. Revise e tente de novo." })) ?? project;
  if (status === null && project.status === "SCHEDULED") return (await setProjectStatus(userId, project.id, "READY", { instagramPostId: null })) ?? project;
  return project;
}

// ---------------------------------------------------------------------------
// Exportação (ZIP)
// ---------------------------------------------------------------------------
function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export interface ExportDeps extends StudioDeps {
  fetchImage?: (url: string) => Promise<Buffer>;
}

async function defaultFetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** ZIP com as artes finais (JPEG 1080×1350, o máximo do feed) + legenda. Não consome cota por si só. */
export async function exportCarouselZip(userId: string, projectId: string, deps: ExportDeps = {}): Promise<{ filename: string; buffer: Buffer }> {
  const project = await requireProject(userId, projectId);
  await finalizeCarousel(userId, projectId, deps);
  const slides = await listSlides(projectId);
  const zip = new JSZip();
  const fetchImage = deps.fetchImage ?? defaultFetchImage;
  for (const slide of slides) {
    if (!slide.renderedMediaId) throw new CarouselError("INCOMPLETE", "Alguma arte não foi gerada. Tente novamente.");
    const media = await getInstagramMediaById(slide.renderedMediaId, userId);
    if (!media || !isBlobUrl(media.storageUrl)) throw new CarouselError("INCOMPLETE", "Não encontrei uma das artes. Gere de novo.");
    zip.file(`slide-${String(slide.position).padStart(2, "0")}.jpg`, await fetchImage(media.storageUrl));
  }
  const fresh = await requireProject(userId, projectId);
  const text = [fresh.caption, fresh.hashtags.join(" ")].filter(Boolean).join("\n\n");
  if (text) zip.file("legenda.txt", text);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const safe = project.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "carrossel";
  return { filename: `${safe}.zip`, buffer };
}

// ---------------------------------------------------------------------------
// Meus carrosséis / histórico
// ---------------------------------------------------------------------------
export interface CarouselSummary {
  id: string;
  title: string;
  topic: string;
  status: CarouselProjectStatus;
  slideCount: number;
  caption: string;
  coverUrl: string | null;
  instagramAccountId: string | null;
  postId: string | null;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
  error: string | null;
}

async function coverUrlOf(userId: string, slides: CarouselSlideRecord[]): Promise<string | null> {
  const first = slides[0];
  if (!first) return null;
  if (first.renderedMediaId) {
    const media = await getInstagramMediaById(first.renderedMediaId, userId);
    if (media) return media.storageUrl;
  }
  return slidePhotoUrl(first);
}

export async function listMyCarousels(userId: string, filter?: { status?: CarouselProjectStatus }): Promise<CarouselSummary[]> {
  const projects = await listProjects(userId, filter?.status);
  const out: CarouselSummary[] = [];
  for (const raw of projects) {
    const project = await syncPublicationStatus(userId, raw);
    out.push({
      id: project.id,
      title: project.title,
      topic: project.topic,
      status: project.status,
      slideCount: project.slideCount,
      caption: project.caption,
      coverUrl: await coverUrlOf(userId, await listSlides(project.id)),
      instagramAccountId: project.instagramAccountId,
      postId: project.instagramPostId,
      completed: project.completedAt !== null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      error: project.error,
    });
  }
  return out;
}

/** "Usar como base": copia texto, estilo e fotos para um NOVO carrossel (conta como novo ao concluir). */
export async function duplicateCarousel(userId: string, projectId: string): Promise<CarouselProjectRecord> {
  const source = await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  const copy = await insertProject({
    userId,
    instagramAccountId: source.instagramAccountId,
    topicId: null,
    title: `${source.title} (cópia)`.slice(0, 80),
    topic: source.topic,
    sourceKind: source.sourceKind,
    sourceRef: source.sourceRef,
    niche: source.niche,
    slideCount: source.slideCount,
    templateId: source.templateId,
    includeEndMedia: source.includeEndMedia,
    brandSnapshot: {},
  });
  await setProjectResearch(userId, copy.id, source.research);
  await updateProjectFields(userId, copy.id, { caption: source.caption, hashtags: source.hashtags });
  if (slides.length > 0) {
    await replaceSlides(
      copy.id,
      slides.map((slide) => ({
        position: slide.position,
        role: slide.role,
        headline: slide.headline,
        body: slide.body,
        cta: slide.cta,
        visualKind: slide.visualKind,
        imageQuery: slide.imageQuery,
        imageMediaId: slide.imageMediaId,
        renderedMediaId: null,
        templateId: slide.templateId,
        style: slide.style,
      })),
    );
    await setProjectStatus(userId, copy.id, "DRAFT");
    await changeProjectStatus(userId, copy.id, "READY");
  }
  return requireProject(userId, copy.id);
}

export async function deleteCarousel(userId: string, projectId: string): Promise<void> {
  const project = await requireProject(userId, projectId);
  if (project.instagramPostId) {
    const status = await getPostStatusForUser(project.instagramPostId, userId);
    if (status && ACTIVE_POST_STATUSES.includes(status)) throw new CarouselError("BAD_TRANSITION", "Não é possível excluir um carrossel publicado ou em publicação.");
  }
  if (!(await deleteProject(userId, projectId))) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
}

export { getProject };
