import "server-only";
import { del, list, type ListBlobResultBlob } from "@vercel/blob";
import { getDb } from "@/lib/db/client";

/**
 * Limpeza automática do Vercel Blob. Os arquivos ficam no Blob até alguém
 * apagar — sem isto o storage só cresce. Regras (prazos editáveis no admin):
 *
 *   videos/uploads/            entradas do Split-Screen (já são apagadas após
 *                              o processamento; aqui pega as abandonadas)  > carência
 *   videos/outputs/            resultado do Split-Screen (sem registro)     > N dias
 *   videos/imports/            importações do Instagram: vencidas (banco) e
 *                              órfãs (upload manual nunca registrado)      > carência
 *   instagram-media/           biblioteca do Instagram: só ÓRFÃS (arquivo sem
 *                              linha em instagram_media nem uso como áudio) > carência
 *   ai-video/{u}/input/         imagens/logos do vídeo com IA sem uso em
 *                              rascunho ou geração em andamento             > N dias
 *   ai-video/{u}/generated/     MP4 sem registro (os registrados já têm
 *                              retenção própria no cron do vídeo com IA)   > carência
 *
 * Segurança: só estes prefixos; nada referenciado no banco é apagado pelas
 * regras de órfãos; limite de exclusões por execução; MODO SIMULAÇÃO
 * (dry_run) que só relata. Cada execução fica em storage_cleanup_runs.
 */

export interface CleanupSettings {
  enabled: boolean;
  dryRun: boolean;
  orphanGraceHours: number;
  splitScreenOutputDays: number;
  instagramImportDays: number;
  aiVideoInputDays: number;
  maxDeletesPerRun: number;
}

export type CleanupRuleId =
  | "split_uploads"
  | "split_outputs"
  | "instagram_imports_expired"
  | "instagram_imports_orphans"
  | "instagram_media_orphans"
  | "ai_video_inputs"
  | "ai_video_generated_orphans";

export const CLEANUP_RULE_LABEL: Record<CleanupRuleId, string> = {
  split_uploads: "Split-Screen: entradas abandonadas",
  split_outputs: "Split-Screen: vídeos gerados vencidos",
  instagram_imports_expired: "Importações do Instagram vencidas",
  instagram_imports_orphans: "Importações: uploads não registrados",
  instagram_media_orphans: "Biblioteca do Instagram: arquivos órfãos",
  ai_video_inputs: "Vídeo com IA: imagens de entrada antigas",
  ai_video_generated_orphans: "Vídeo com IA: MP4 sem registro",
};

export interface RuleReport {
  scanned: number;
  matched: number;
  deleted: number;
  bytes: number;
}

export interface CleanupReport {
  dryRun: boolean;
  rules: Record<CleanupRuleId, RuleReport>;
  /** Uso atual por pasta (arquivos e bytes vistos nesta execução). */
  usage: Record<string, { files: number; bytes: number }>;
  stoppedEarly: boolean;
}

export async function getCleanupSettings(): Promise<CleanupSettings> {
  const db = getDb();
  const [row] = await db`select * from storage_cleanup_settings where id = 1`;
  return {
    enabled: row ? Boolean(row.enabled) : true,
    dryRun: row ? Boolean(row.dry_run) : true,
    orphanGraceHours: Number(row?.orphan_grace_hours ?? 24),
    splitScreenOutputDays: Number(row?.split_screen_output_days ?? 3),
    instagramImportDays: Number(row?.instagram_import_days ?? 7),
    aiVideoInputDays: Number(row?.ai_video_input_days ?? 30),
    maxDeletesPerRun: Number(row?.max_deletes_per_run ?? 500),
  };
}

export async function updateCleanupSettings(settings: CleanupSettings): Promise<void> {
  const db = getDb();
  await db`
    insert into storage_cleanup_settings (id, enabled, dry_run, orphan_grace_hours, split_screen_output_days, instagram_import_days, ai_video_input_days, max_deletes_per_run, updated_at)
    values (1, ${settings.enabled}, ${settings.dryRun}, ${settings.orphanGraceHours}, ${settings.splitScreenOutputDays}, ${settings.instagramImportDays},
      ${settings.aiVideoInputDays}, ${settings.maxDeletesPerRun}, now())
    on conflict (id) do update set
      enabled = excluded.enabled, dry_run = excluded.dry_run, orphan_grace_hours = excluded.orphan_grace_hours,
      split_screen_output_days = excluded.split_screen_output_days, instagram_import_days = excluded.instagram_import_days,
      ai_video_input_days = excluded.ai_video_input_days, max_deletes_per_run = excluded.max_deletes_per_run, updated_at = now()
  `;
}

const emptyRule = (): RuleReport => ({ scanned: 0, matched: 0, deleted: 0, bytes: 0 });

/** Separador seguro: URLs do Blob nunca têm espaço literal (vem codificado). */
const joinUrls = (urls: string[]) => urls.join(" ");

async function referencedSet(rule: CleanupRuleId, urls: string[], aiInputCutoff: Date): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const db = getDb();
  const list_ = joinUrls(urls);
  let rows: Record<string, unknown>[] = [];
  if (rule === "instagram_imports_orphans") {
    // Carrossel: cada item guardado (imported_items) também é referência.
    rows = await db`
      select imported_file_url as url from instagram_media_imports where imported_file_url = any(string_to_array(${list_}, ' '))
      union select item->>'fileUrl' from instagram_media_imports, jsonb_array_elements(imported_items) as item
        where item->>'fileUrl' = any(string_to_array(${list_}, ' '))
    `;
  } else if (rule === "instagram_media_orphans") {
    rows = await db`
      select storage_url as url from instagram_media where storage_url = any(string_to_array(${list_}, ' '))
      union select default_audio_file_url from instagram_accounts where default_audio_file_url = any(string_to_array(${list_}, ' '))
      union select audio_file_url from instagram_posts where audio_file_url = any(string_to_array(${list_}, ' '))
    `;
  } else if (rule === "ai_video_generated_orphans") {
    rows = await db`select storage_video_url as url from ai_video_generations where storage_video_url = any(string_to_array(${list_}, ' '))`;
  } else if (rule === "ai_video_inputs") {
    rows = await db`
      select input_image_url as url from ai_video_drafts where input_image_url = any(string_to_array(${list_}, ' '))
      union select input_image_url from ai_video_generations
        where input_image_url = any(string_to_array(${list_}, ' '))
          and (status in ('CREATED', 'CREDIT_RESERVED', 'SUBMITTED', 'QUEUED', 'PROCESSING', 'AI_COMPLETED', 'POST_PROCESSING')
               or created_at >= ${aiInputCutoff.toISOString()})
    `;
    // Logos dos overlays (jsonb) em rascunhos e gerações recentes/ativas.
    const overlayRows = await db`
      select overlays::text as text from ai_video_drafts where overlays is not null
      union all select overlays::text from ai_video_generations
        where overlays <> '[]'::jsonb
          and (status in ('CREATED', 'CREDIT_RESERVED', 'SUBMITTED', 'QUEUED', 'PROCESSING', 'AI_COMPLETED', 'POST_PROCESSING')
               or created_at >= ${aiInputCutoff.toISOString()})
    `;
    const overlayText = overlayRows.map((row) => String(row.text ?? "")).join("\n");
    for (const url of urls) if (overlayText.includes(url)) rows.push({ url });
  }
  return new Set(rows.map((row) => String(row.url)));
}

interface PrefixPlan {
  prefix: string;
  usageKey: string;
  classify: (blob: ListBlobResultBlob) => { rule: CleanupRuleId; olderThan: Date; checkReferences: boolean } | null;
}

export async function runStorageCleanup(options: {
  trigger: "CRON" | "ADMIN";
  dryRunOverride?: boolean;
  now?: Date;
  budgetMs?: number;
}): Promise<{ runId: string; report: CleanupReport; skipped?: boolean }> {
  const now = options.now ?? new Date();
  const budget = options.budgetMs ?? 45_000;
  const startedAt = Date.now();
  const settings = await getCleanupSettings();
  const dryRun = options.dryRunOverride ?? settings.dryRun;
  const db = getDb();

  const report: CleanupReport = {
    dryRun,
    rules: {
      split_uploads: emptyRule(),
      split_outputs: emptyRule(),
      instagram_imports_expired: emptyRule(),
      instagram_imports_orphans: emptyRule(),
      instagram_media_orphans: emptyRule(),
      ai_video_inputs: emptyRule(),
      ai_video_generated_orphans: emptyRule(),
    },
    usage: {},
    stoppedEarly: false,
  };

  if (!settings.enabled && options.trigger === "CRON") {
    return { runId: "", report, skipped: true };
  }

  const [run] = await db`insert into storage_cleanup_runs (trigger, dry_run) values (${options.trigger}, ${dryRun}) returning id`;
  const runId = run.id as string;
  let remaining = settings.maxDeletesPerRun;
  const hours = (value: number) => new Date(now.getTime() - value * 3600_000);
  const grace = hours(settings.orphanGraceHours);
  const aiInputCutoff = hours(settings.aiVideoInputDays * 24);
  const outOfTime = () => Date.now() - startedAt > budget;

  const removeBlobs = async (rule: CleanupRuleId, blobs: Array<{ url: string; size: number }>) => {
    const take = blobs.slice(0, Math.max(0, remaining));
    report.rules[rule].matched += blobs.length;
    if (take.length === 0) return;
    if (!dryRun) {
      for (let i = 0; i < take.length; i += 100) await del(take.slice(i, i + 100).map((blob) => blob.url));
    }
    remaining -= take.length;
    report.rules[rule].deleted += take.length;
    report.rules[rule].bytes += take.reduce((sum, blob) => sum + blob.size, 0);
  };

  try {
    // 1) Importações do Instagram vencidas (retenção pelo banco).
    const importCutoff = hours(settings.instagramImportDays * 24);
    const expired = await db`
      select id, imported_file_url, imported_items, coalesce(file_size_bytes, 0) as size from instagram_media_imports
      where status = 'COMPLETED' and imported_file_url is not null and completed_at < ${importCutoff.toISOString()}
      order by completed_at limit ${Math.max(0, remaining)}
    `;
    report.rules.instagram_imports_expired.scanned = expired.length;
    if (expired.length > 0) {
      // Carrossel: apaga também os demais itens guardados (o 1º é o imported_file_url).
      const carouselExtras = expired.flatMap((row) => {
        const list = Array.isArray(row.imported_items) ? (row.imported_items as Array<{ fileUrl?: string; fileSizeBytes?: number }>) : [];
        return list
          .filter((item) => typeof item.fileUrl === "string" && item.fileUrl !== row.imported_file_url)
          .map((item) => ({ url: item.fileUrl as string, size: Number(item.fileSizeBytes ?? 0) }));
      });
      await removeBlobs("instagram_imports_expired", [
        ...expired.map((row) => ({ url: String(row.imported_file_url), size: Number(row.size) })),
        ...carouselExtras,
      ]);
      if (!dryRun) {
        const ids = expired.slice(0, report.rules.instagram_imports_expired.deleted).map((row) => String(row.id));
        await db`
          update instagram_media_imports set status = 'EXPIRED', imported_file_url = null, storage_path = null, imported_items = '[]'::jsonb
          where id = any(string_to_array(${ids.join(" ")}, ' ')::uuid[])
        `;
      }
    }

    // 2) Varredura das pastas.
    const plans: PrefixPlan[] = [
      { prefix: "videos/uploads/", usageKey: "videos/uploads", classify: () => ({ rule: "split_uploads", olderThan: grace, checkReferences: false }) },
      {
        prefix: "videos/outputs/",
        usageKey: "videos/outputs",
        classify: () => ({ rule: "split_outputs", olderThan: hours(settings.splitScreenOutputDays * 24), checkReferences: false }),
      },
      { prefix: "videos/imports/", usageKey: "videos/imports", classify: () => ({ rule: "instagram_imports_orphans", olderThan: grace, checkReferences: true }) },
      { prefix: "instagram-media/", usageKey: "instagram-media", classify: () => ({ rule: "instagram_media_orphans", olderThan: grace, checkReferences: true }) },
      {
        prefix: "ai-video/",
        usageKey: "ai-video",
        classify: (blob) =>
          blob.pathname.includes("/input/")
            ? { rule: "ai_video_inputs", olderThan: aiInputCutoff, checkReferences: true }
            : blob.pathname.includes("/generated/")
              ? { rule: "ai_video_generated_orphans", olderThan: grace, checkReferences: true }
              : null,
      },
    ];

    for (const plan of plans) {
      let cursor: string | undefined;
      const usage = (report.usage[plan.usageKey] = { files: 0, bytes: 0 });
      do {
        if (outOfTime()) {
          report.stoppedEarly = true;
          break;
        }
        const page = await list({ prefix: plan.prefix, cursor, limit: 1000 });
        cursor = page.hasMore ? page.cursor : undefined;
        const candidates = new Map<CleanupRuleId, ListBlobResultBlob[]>();
        for (const blob of page.blobs) {
          usage.files += 1;
          usage.bytes += blob.size;
          const decision = plan.classify(blob);
          if (!decision) continue;
          report.rules[decision.rule].scanned += 1;
          if (new Date(blob.uploadedAt).getTime() >= decision.olderThan.getTime()) continue;
          const list_ = candidates.get(decision.rule) ?? [];
          list_.push(blob);
          candidates.set(decision.rule, list_);
        }
        for (const [rule, blobs] of candidates) {
          const needsCheck = rule !== "split_uploads" && rule !== "split_outputs";
          const referenced = needsCheck ? await referencedSet(rule, blobs.map((blob) => blob.url), aiInputCutoff) : new Set<string>();
          await removeBlobs(rule, blobs.filter((blob) => !referenced.has(blob.url)));
        }
      } while (cursor);
      if (report.stoppedEarly) break;
    }
  } catch (error) {
    const message = (error as Error)?.message?.slice(0, 500) ?? "erro";
    await db`update storage_cleanup_runs set finished_at = now(), report = ${JSON.stringify(report)}::jsonb, error = ${message} where id = ${runId}`;
    console.error(JSON.stringify({ scope: "storage-cleanup", event: "failed", runId, message }));
    throw error;
  }

  const deletedFiles = Object.values(report.rules).reduce((sum, rule) => sum + rule.deleted, 0);
  const deletedBytes = Object.values(report.rules).reduce((sum, rule) => sum + rule.bytes, 0);
  await db`
    update storage_cleanup_runs set finished_at = now(), deleted_files = ${deletedFiles}, deleted_bytes = ${deletedBytes},
      report = ${JSON.stringify(report)}::jsonb
    where id = ${runId}
  `;
  console.info(JSON.stringify({ scope: "storage-cleanup", event: "done", runId, dryRun, deletedFiles, deletedBytes, stoppedEarly: report.stoppedEarly }));
  return { runId, report };
}

export interface CleanupRunView {
  id: string;
  trigger: string;
  dryRun: boolean;
  startedAt: string;
  finishedAt: string | null;
  deletedFiles: number;
  deletedBytes: number;
  report: CleanupReport | null;
  error: string | null;
}

export async function listCleanupRuns(limit = 10): Promise<CleanupRunView[]> {
  const db = getDb();
  const rows = await db`select * from storage_cleanup_runs order by started_at desc limit ${limit}`;
  return rows.map((row) => ({
    id: String(row.id),
    trigger: String(row.trigger),
    dryRun: Boolean(row.dry_run),
    startedAt: new Date(row.started_at as string).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at as string).toISOString() : null,
    deletedFiles: Number(row.deleted_files),
    deletedBytes: Number(row.deleted_bytes),
    report: (typeof row.report === "string" ? JSON.parse(row.report) : row.report) as CleanupReport | null,
    error: (row.error as string | null) ?? null,
  }));
}
