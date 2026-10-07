import "server-only";
import { CAROUSEL_LIMITS, getCarouselPlan, listCarouselPlans } from "../carousel-plans";
import {
  canTransition,
  clampSlideCount,
  isVisualKind,
  normalizeSlideText,
  slideRolesFor,
  truncateAtWord,
  type CarouselProjectStatus,
  type CarouselSourceKind,
  type VisualKind,
} from "../domain";
import { consumeCarouselQuota, getCarouselAccess, paidCarouselPlanOf, type CarouselAccess } from "./carousel-access-service";
import { getCarouselSubscription } from "./carousel-billing-repository";
import {
  deleteSlidesAfter,
  getCarouselBrand,
  getProject,
  insertProject,
  listProfilesInUse,
  listSlides,
  markProjectCompleted,
  setProjectStatus,
  updateProjectFields,
  upsertSlide,
  userOwnsInstagramAccount,
  type CarouselProjectRecord,
  type CarouselSlideRecord,
} from "./carousel-repository";

export type CarouselErrorCode =
  | "NOT_FOUND"
  | "INVALID"
  | "PROFILE_LIMIT"
  | "ACCESS_DENIED"
  | "INCOMPLETE"
  | "BAD_TRANSITION";

export class CarouselError extends Error {
  constructor(
    public readonly code: CarouselErrorCode,
    message: string,
    public readonly access?: CarouselAccess,
  ) {
    super(message);
    this.name = "CarouselError";
  }
}

/** Limite de perfis do usuário: o do plano pago em vigor; sem plano (carrossel grátis), o menor plano. */
export async function maxProfilesFor(userId: string, now: Date = new Date()): Promise<number> {
  const plan = paidCarouselPlanOf(await getCarouselSubscription(userId), now);
  return (plan ?? listCarouselPlans()[0]).maxProfiles;
}

async function assertProfileAllowed(userId: string, accountId: string, now: Date): Promise<void> {
  if (!(await userOwnsInstagramAccount(userId, accountId))) {
    throw new CarouselError("INVALID", "Conta do Instagram inválida.");
  }
  const inUse = await listProfilesInUse(userId);
  if (inUse.includes(accountId)) return;
  const limit = await maxProfilesFor(userId, now);
  if (inUse.length >= limit) {
    throw new CarouselError("PROFILE_LIMIT", `Seu plano permite carrosséis para até ${limit} perfis do Instagram. Use um dos perfis já utilizados ou faça upgrade.`);
  }
}

export interface CreateProjectInput {
  userId: string;
  topic: string;
  sourceKind?: CarouselSourceKind;
  sourceRef?: string | null;
  topicId?: string | null;
  niche?: string | null;
  instagramAccountId?: string | null;
  slideCount?: number;
  templateId?: string | null;
  includeEndMedia?: boolean;
  now?: Date;
}

/**
 * Cria o projeto em rascunho. NÃO consome cota (isso só acontece ao concluir)
 * e nem chama IA. Exige que o usuário ainda possa criar (plano com cota ou
 * carrossel grátis disponível) para não gerar custo de IA sem direito.
 */
export async function createCarouselProject(input: CreateProjectInput): Promise<CarouselProjectRecord> {
  const now = input.now ?? new Date();
  const topic = input.topic.replace(/\s+/g, " ").trim();
  if (!topic) throw new CarouselError("INVALID", "Informe o tema do carrossel.");
  if (topic.length > CAROUSEL_LIMITS.topic) throw new CarouselError("INVALID", `O tema pode ter até ${CAROUSEL_LIMITS.topic} caracteres.`);

  const access = await getCarouselAccess(input.userId, now);
  if (!access.allowed) throw new CarouselError("ACCESS_DENIED", access.reason ?? "Sem acesso ao Carrossel Inteligente.", access);

  if (input.instagramAccountId) await assertProfileAllowed(input.userId, input.instagramAccountId, now);

  const brand = await getCarouselBrand(input.userId);
  return insertProject({
    userId: input.userId,
    instagramAccountId: input.instagramAccountId ?? null,
    topicId: input.topicId ?? null,
    title: truncateAtWord(topic, 80),
    topic,
    sourceKind: input.sourceKind ?? "TOPIC",
    sourceRef: input.sourceRef ?? null,
    niche: input.niche ?? brand?.niche ?? null,
    slideCount: clampSlideCount(input.slideCount),
    templateId: input.templateId ?? brand?.defaultTemplateId ?? null,
    includeEndMedia: input.includeEndMedia ?? true,
    brandSnapshot: brand ? { ...brand } : {},
  });
}

export async function requireProject(userId: string, projectId: string): Promise<CarouselProjectRecord> {
  const project = await getProject(userId, projectId);
  if (!project) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
  return project;
}

export async function assignInstagramProfile(userId: string, projectId: string, accountId: string, now: Date = new Date()): Promise<CarouselProjectRecord> {
  await requireProject(userId, projectId);
  await assertProfileAllowed(userId, accountId, now);
  const updated = await updateProjectFields(userId, projectId, { instagramAccountId: accountId });
  if (!updated) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
  return updated;
}

export interface SlideDraftInput {
  headline?: unknown;
  body?: unknown;
  cta?: unknown;
  visualKind?: unknown;
  imageQuery?: unknown;
  templateId?: unknown;
}

/**
 * Grava os slides do projeto (regerar ou editar NÃO conta como novo
 * carrossel). Papéis vêm da estrutura narrativa da quantidade escolhida;
 * textos são normalizados nos limites (70/220/CTA curto). Posição 1..N.
 */
export async function saveProjectSlides(userId: string, projectId: string, slides: SlideDraftInput[]): Promise<CarouselSlideRecord[]> {
  const project = await requireProject(userId, projectId);
  if (slides.length < CAROUSEL_LIMITS.minSlides || slides.length > CAROUSEL_LIMITS.maxSlides) {
    throw new CarouselError("INVALID", `O carrossel precisa ter de ${CAROUSEL_LIMITS.minSlides} a ${CAROUSEL_LIMITS.maxSlides} slides.`);
  }
  const roles = slideRolesFor(slides.length);
  const saved: CarouselSlideRecord[] = [];
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const text = normalizeSlideText(slide);
    const visualKind: VisualKind = isVisualKind(slide.visualKind) ? slide.visualKind : "GRAPHIC";
    saved.push(
      await upsertSlide(projectId, {
        position: index + 1,
        role: roles[index],
        headline: text.headline,
        body: text.body,
        cta: text.cta,
        visualKind,
        imageQuery: typeof slide.imageQuery === "string" && slide.imageQuery.trim() ? slide.imageQuery.trim().slice(0, 120) : null,
        templateId: typeof slide.templateId === "string" ? slide.templateId : null,
      }),
    );
  }
  await deleteSlidesAfter(projectId, slides.length);
  if (project.slideCount !== slides.length) await updateProjectFields(userId, projectId, { slideCount: slides.length });
  return saved;
}

export async function changeProjectStatus(userId: string, projectId: string, to: CarouselProjectStatus, extra: { error?: string | null; instagramPostId?: string | null } = {}): Promise<CarouselProjectRecord> {
  const project = await requireProject(userId, projectId);
  if (!canTransition(project.status, to)) throw new CarouselError("BAD_TRANSITION", `Não é possível mudar de ${project.status} para ${to}.`);
  const updated = await setProjectStatus(userId, projectId, to, extra);
  if (!updated) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
  return updated;
}

/** Falha de geração: o projeto vai para FAILED e NADA é cobrado. */
export async function failCarouselProject(userId: string, projectId: string, error: string): Promise<CarouselProjectRecord> {
  const updated = await setProjectStatus(userId, projectId, "FAILED", { error: error.slice(0, 500) });
  if (!updated) throw new CarouselError("NOT_FOUND", "Carrossel não encontrado.");
  return updated;
}

export interface CompleteProjectResult {
  project: CarouselProjectRecord;
  /** true = esta chamada consumiu a cota; false = já estava concluído/contado. */
  counted: boolean;
}

/**
 * Conclui o carrossel: confere que há slides completos e consome UMA cota
 * (plano ou carrossel grátis). Idempotente: concluir de novo, regenerar o
 * projeto inteiro ou editar slides nunca conta outra vez.
 */
export async function completeCarouselProject(userId: string, projectId: string, now: Date = new Date()): Promise<CompleteProjectResult> {
  const project = await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  if (slides.length < CAROUSEL_LIMITS.minSlides || slides.some((slide) => !slide.headline.trim())) {
    throw new CarouselError("INCOMPLETE", "O carrossel ainda não tem todos os slides com título.");
  }
  if (project.completedAt) return { project, counted: false };

  const quota = await consumeCarouselQuota(userId, projectId, now);
  if (quota.status === "denied") {
    throw new CarouselError("ACCESS_DENIED", quota.access.reason ?? "Sem cota para concluir o carrossel.", quota.access);
  }
  const markedNow = await markProjectCompleted(userId, projectId);
  const fresh = await requireProject(userId, projectId);
  return { project: fresh, counted: quota.status === "counted" && markedNow };
}

export { getCarouselPlan };
