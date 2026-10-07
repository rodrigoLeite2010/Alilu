import "server-only";
import { getDb } from "@/lib/db/client";
import {
  isStoryType,
  isVisualMood,
  type StoryContent,
  type StoryHistoryItem,
  type StoryLayout,
  type StoryStatus,
} from "../smart-story/types";

/** Linha de smart_story_generations (um Story inteligente de um horário). */
export interface SmartStoryRecord {
  id: string;
  userId: string;
  automationId: string;
  runId: string | null;
  scheduledAt: Date;
  content: StoryContent;
  theme: string | null;
  templateId: string | null;
  promptUsed: string;
  usedMascot: boolean;
  layout: StoryLayout;
  sequenceCount: number;
  source: "AI" | "FALLBACK";
  attempts: number;
  generationError: string | null;
  imageUrl: string | null;
  instagramPostId: string | null;
  instagramMediaId: string | null;
  status: StoryStatus;
  publishedAt: Date | null;
  createdAt: Date;
}

type Row = Record<string, unknown>;

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function toRecord(row: Row): SmartStoryRecord {
  const type = isStoryType(row.story_type) ? row.story_type : "REFLECTION";
  return {
    id: row.id as string,
    userId: row.user_id as string,
    automationId: row.automation_id as string,
    runId: (row.run_id as string | null) ?? null,
    scheduledAt: toDate(row.scheduled_at),
    content: {
      type,
      headline: row.headline as string,
      body: (row.body as string) ?? "",
      optionA: (row.option_a as string) ?? "",
      optionB: (row.option_b as string) ?? "",
      cta: (row.cta as string) ?? "",
      visualMood: isVisualMood(row.visual_mood) ? row.visual_mood : "neutral",
      topic: (row.topic as string) ?? "",
    },
    theme: (row.theme as string | null) ?? null,
    templateId: (row.template_id as string | null) ?? null,
    promptUsed: (row.prompt_used as string) ?? "",
    usedMascot: row.used_mascot === true,
    layout: row.layout === "SEQUENCE" ? "SEQUENCE" : "SINGLE",
    sequenceCount: Number(row.sequence_count ?? 1),
    source: row.source === "FALLBACK" ? "FALLBACK" : "AI",
    attempts: Number(row.attempts ?? 1),
    generationError: (row.generation_error as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    instagramPostId: (row.instagram_post_id as string | null) ?? null,
    instagramMediaId: (row.instagram_media_id as string | null) ?? null,
    status: row.status as StoryStatus,
    publishedAt: row.published_at ? toDate(row.published_at) : null,
    createdAt: toDate(row.created_at),
  };
}

export function toHistoryItem(record: SmartStoryRecord): StoryHistoryItem {
  return {
    storyType: record.content.type,
    headline: record.content.headline,
    topic: record.content.topic,
    cta: record.content.cta,
    usedMascot: record.usedMascot,
    generatedAt: record.createdAt,
  };
}

/** Stories inteligentes anteriores da automação, mais recente primeiro (antirrepetição + contexto da IA). */
export async function listRecentSmartStories(
  automationId: string,
  limit: number,
  before?: Date,
): Promise<SmartStoryRecord[]> {
  const db = getDb();
  const cutoff = (before ?? new Date(8.64e15)).toISOString();
  const rows = await db`
    select * from smart_story_generations
    where automation_id = ${automationId} and scheduled_at < ${cutoff}
    order by scheduled_at desc
    limit ${Math.max(0, limit)}
  `;
  return rows.map(toRecord);
}

export async function getSmartStoryForSlot(automationId: string, scheduledAt: Date): Promise<SmartStoryRecord | null> {
  const db = getDb();
  const rows = await db`
    select * from smart_story_generations
    where automation_id = ${automationId} and scheduled_at = ${scheduledAt.toISOString()}
  `;
  return rows[0] ? toRecord(rows[0]) : null;
}

export interface InsertSmartStoryInput {
  userId: string;
  automationId: string;
  runId: string | null;
  scheduledAt: Date;
  content: StoryContent;
  theme: string;
  promptUsed: string;
  usedMascot: boolean;
  layout: StoryLayout;
  sequenceCount: number;
  source: "AI" | "FALLBACK";
  attempts: number;
  generationError: string | null;
}

/**
 * Grava o Story do horário — IDEMPOTENTE: UNIQUE (automation_id,
 * scheduled_at) + ON CONFLICT DO NOTHING (um único comando atômico, como
 * o driver HTTP do Neon exige). Duas execuções concorrentes do mesmo
 * horário: só uma insere; as duas recebem o MESMO registro (o vencedor).
 */
export async function insertSmartStoryOnce(input: InsertSmartStoryInput): Promise<{ record: SmartStoryRecord; created: boolean }> {
  const db = getDb();
  const { content } = input;
  const inserted = await db`
    insert into smart_story_generations (
      user_id, automation_id, run_id, scheduled_at, story_type, theme, prompt_used,
      headline, body, option_a, option_b, cta, visual_mood, topic, used_mascot,
      layout, sequence_count, source, attempts, generation_error
    ) values (
      ${input.userId}, ${input.automationId}, ${input.runId}, ${input.scheduledAt.toISOString()}, ${content.type}, ${input.theme}, ${input.promptUsed.slice(0, 6000)},
      ${content.headline}, ${content.body}, ${content.optionA}, ${content.optionB}, ${content.cta}, ${content.visualMood}, ${content.topic}, ${input.usedMascot},
      ${input.layout}, ${input.sequenceCount}, ${input.source}, ${input.attempts}, ${input.generationError}
    )
    on conflict (automation_id, scheduled_at) do nothing
    returning *
  `;
  if (inserted[0]) return { record: toRecord(inserted[0]), created: true };
  const existing = await getSmartStoryForSlot(input.automationId, input.scheduledAt);
  if (!existing) throw new Error("Não foi possível gravar nem recuperar o Story inteligente do horário.");
  return { record: existing, created: false };
}

export interface SmartStoryProgress {
  status: StoryStatus;
  templateId?: string | null;
  imageUrl?: string | null;
  instagramPostId?: string | null;
  instagramMediaId?: string | null;
  publishedAt?: Date | null;
  runId?: string | null;
}

/** Atualiza só o que foi informado (COALESCE) e o status — para o fluxo Generated→…→Published. */
export async function updateSmartStoryProgress(id: string, progress: SmartStoryProgress): Promise<void> {
  const db = getDb();
  await db`
    update smart_story_generations set
      status = ${progress.status},
      template_id = coalesce(${progress.templateId ?? null}, template_id),
      image_url = coalesce(${progress.imageUrl ?? null}, image_url),
      instagram_post_id = coalesce(${progress.instagramPostId ?? null}, instagram_post_id),
      instagram_media_id = coalesce(${progress.instagramMediaId ?? null}, instagram_media_id),
      published_at = coalesce(${progress.publishedAt ? progress.publishedAt.toISOString() : null}, published_at),
      run_id = coalesce(${progress.runId ?? null}, run_id),
      updated_at = now()
    where id = ${id}
  `;
}
