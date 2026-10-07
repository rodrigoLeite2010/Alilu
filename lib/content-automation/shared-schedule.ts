import {
  DAYS_OF_WEEK,
  MAX_SLOTS_PER_DAY,
  type AutomationDayRecord,
  type AutomationRecord,
  type AutomationWithDays,
  type DayOfWeek,
} from "./backend/automation-types";

/**
 * Regras puras do modo "Prompt único recorrente" (SHARED_PROMPT) — nenhum
 * acesso a banco, sem "server-only": pode ser testado sem mocks e reusado
 * pela tela (resumo "N execuções por semana").
 *
 * Modelo (ver db/migrations/0033_automation_shared_prompt.sql): o
 * conteúdo fica UMA vez na automação (`shared`); as linhas de
 * content_automation_days continuam sendo as ocorrências (dia + horário)
 * e só dizem QUANDO executar. Na hora de gerar, o conteúdo compartilhado
 * é sobreposto à linha (`applySharedConfig`).
 */

export class SharedScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedScheduleError";
  }
}

export const SCHEDULE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Até quantos horários por dia (mesmo teto do modo personalizado). */
export const MAX_SHARED_TIMES = MAX_SLOTS_PER_DAY;

type ModeFields = Pick<AutomationRecord, "scheduleMode" | "shared">;

/**
 * Linha de dia/horário "efetiva": no modo SHARED_PROMPT, o conteúdo vem da
 * automação; no modo CUSTOM (e para automações antigas), devolve a própria
 * linha, intacta. Dia, horário, slot e `enabled` são sempre os da linha.
 */
export function applySharedConfig(automation: ModeFields, day: AutomationDayRecord): AutomationDayRecord {
  if (automation.scheduleMode !== "SHARED_PROMPT") return day;
  const shared = automation.shared;
  return {
    ...day,
    contentType: shared.contentType,
    contentMode: shared.contentMode,
    contentCategory: shared.contentCategory,
    prompt: shared.prompt,
    manualCaption: shared.manualCaption,
    visualText: shared.visualText,
    templateId: shared.templateId,
    styleConfig: shared.styleConfig,
    overlayOpacity: shared.overlayOpacity,
    visualTextColor: shared.visualTextColor,
    imageMediaId: shared.imageMediaId,
    videoMediaId: shared.videoMediaId,
  };
}

export function effectiveDays(automation: AutomationWithDays): AutomationDayRecord[] {
  return automation.days.map((day) => applySharedConfig(automation, day));
}

/** Dias e horários atualmente habilitados (união) — o que a tela mostra no modo compartilhado. */
export function deriveSharedSchedule(days: AutomationDayRecord[]): { days: DayOfWeek[]; times: string[] } {
  const enabled = days.filter((day) => day.enabled);
  const daySet = new Set(enabled.map((day) => day.dayOfWeek));
  const times = [...new Set(enabled.map((day) => day.publishTime))].sort();
  return { days: DAYS_OF_WEEK.filter((day) => daySet.has(day)), times };
}

/** Quantas execuções por semana a agenda atual gera (uma por linha habilitada). */
export function countWeeklyExecutions(days: Pick<AutomationDayRecord, "enabled">[]): number {
  return days.filter((day) => day.enabled).length;
}

export interface SharedScheduleInput {
  days: DayOfWeek[];
  times: string[];
}

/**
 * Valida a agenda do modo compartilhado: pelo menos 1 dia e 1 horário,
 * horários HH:mm sem repetição, até MAX_SHARED_TIMES por dia. Devolve dias
 * (na ordem da semana) e horários (ordenados).
 */
export function validateSharedSchedule(input: { days: unknown; times: unknown }): SharedScheduleInput {
  if (!Array.isArray(input.days) || input.days.length === 0) {
    throw new SharedScheduleError("Escolha pelo menos um dia da semana.");
  }
  if (!Array.isArray(input.times) || input.times.length === 0) {
    throw new SharedScheduleError("Adicione pelo menos um horário.");
  }
  const daySet = new Set<DayOfWeek>();
  for (const day of input.days) {
    if (typeof day !== "string" || !DAYS_OF_WEEK.includes(day as DayOfWeek)) {
      throw new SharedScheduleError("Dia da semana inválido.");
    }
    daySet.add(day as DayOfWeek);
  }
  const times: string[] = [];
  for (const time of input.times) {
    if (typeof time !== "string" || !SCHEDULE_TIME_RE.test(time)) {
      throw new SharedScheduleError("Horário inválido (use HH:mm).");
    }
    if (times.includes(time)) {
      throw new SharedScheduleError(`O horário ${time} está repetido.`);
    }
    times.push(time);
  }
  if (times.length > MAX_SHARED_TIMES) {
    throw new SharedScheduleError(`Cada dia pode ter no máximo ${MAX_SHARED_TIMES} horários.`);
  }
  return { days: DAYS_OF_WEEK.filter((day) => daySet.has(day)), times: [...times].sort() };
}

export interface ReconcileRow {
  id: string;
  dayOfWeek: DayOfWeek;
  slotIndex: number;
  publishTime: string;
  enabled: boolean;
  /** Já existe alguma execução (automation_runs) apontando para esta linha? */
  hasRuns: boolean;
}

export interface ReconcilePlan {
  /** Linhas que saem da agenda: enabled = false (NUNCA apagadas — apagar levaria o histórico junto). */
  disable: string[];
  /** Linhas existentes (re)ligadas, com o horário final. */
  update: { id: string; publishTime: string }[];
  /** Linhas novas (dia + horário). */
  insert: { dayOfWeek: DayOfWeek; publishTime: string; slotIndex: number }[];
}

/**
 * Compara a agenda desejada (dias × horários) com as linhas existentes e
 * devolve o MÍNIMO de mudanças, sem criar registros órfãos nem duplicados:
 *  - linha ligada que já está na agenda → não mexe (mesmo id, mesmo
 *    histórico);
 *  - linha ligada fora da agenda → desabilita (não apaga);
 *  - horário faltando → reaproveita, nesta ordem, uma linha desligada com
 *    o MESMO horário (histórico continua coerente), uma desligada que
 *    nunca executou, e só então cria uma nova; no teto de linhas por dia,
 *    reaproveita a primeira desligada mesmo com histórico.
 * Resultado final: exatamente dias × horários linhas habilitadas.
 */
export function planScheduleReconciliation(rows: ReconcileRow[], desired: SharedScheduleInput): ReconcilePlan {
  const selected = new Set(desired.days);
  const plan: ReconcilePlan = { disable: [], update: [], insert: [] };

  for (const dayOfWeek of DAYS_OF_WEEK) {
    const wanted = selected.has(dayOfWeek) ? desired.times : [];
    const dayRows = rows.filter((row) => row.dayOfWeek === dayOfWeek).sort((a, b) => a.slotIndex - b.slotIndex);

    const keptTimes = new Set<string>();
    const releasing: ReconcileRow[] = [];
    for (const row of dayRows.filter((candidate) => candidate.enabled)) {
      if (wanted.includes(row.publishTime) && !keptTimes.has(row.publishTime)) keptTimes.add(row.publishTime);
      else releasing.push(row);
    }

    const pool: ReconcileRow[] = [...dayRows.filter((row) => !row.enabled), ...releasing];
    const stillDisabled = new Set(releasing.map((row) => row.id));
    let totalRows = dayRows.length;
    let nextSlotIndex = dayRows.reduce((max, row) => Math.max(max, row.slotIndex), -1) + 1;

    for (const time of wanted.filter((candidate) => !keptTimes.has(candidate))) {
      const take = (row: ReconcileRow) => {
        pool.splice(pool.indexOf(row), 1);
        stillDisabled.delete(row.id);
        plan.update.push({ id: row.id, publishTime: time });
      };
      const sameTime = pool.find((row) => row.publishTime === time);
      if (sameTime) {
        take(sameTime);
        continue;
      }
      const neverRan = pool.find((row) => !row.hasRuns);
      if (neverRan) {
        take(neverRan);
        continue;
      }
      if (totalRows < MAX_SLOTS_PER_DAY) {
        plan.insert.push({ dayOfWeek, publishTime: time, slotIndex: nextSlotIndex });
        nextSlotIndex += 1;
        totalRows += 1;
        continue;
      }
      const reuse = pool[0];
      if (!reuse) throw new SharedScheduleError(`Cada dia pode ter no máximo ${MAX_SHARED_TIMES} horários.`);
      take(reuse);
    }

    plan.disable.push(...releasing.filter((row) => stillDisabled.has(row.id)).map((row) => row.id));
  }
  return plan;
}

export const DAY_SHORT_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

const DAY_FULL_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

/**
 * Texto curto dos dias para o resumo: "Todos os dias", "Segunda a sexta",
 * "Segunda a quarta" (3+ dias seguidos) ou "Seg, Qua e Sex".
 */
export function formatDaysSummary(days: DayOfWeek[]): string {
  const ordered = DAYS_OF_WEEK.filter((day) => days.includes(day));
  if (ordered.length === 0) return "Nenhum dia";
  if (ordered.length === 7) return "Todos os dias";
  const firstIndex = DAYS_OF_WEEK.indexOf(ordered[0]);
  const contiguous = ordered.every((day, offset) => DAYS_OF_WEEK.indexOf(day) === firstIndex + offset);
  if (contiguous && ordered.length >= 3) {
    return `${DAY_FULL_LABEL[ordered[0]]} a ${DAY_FULL_LABEL[ordered[ordered.length - 1]].toLowerCase()}`;
  }
  const labels = ordered.map((day) => DAY_SHORT_LABEL[day]);
  if (labels.length === 1) return DAY_FULL_LABEL[ordered[0]];
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

/** Primeiro horário "redondo" que ainda não está na lista — usado pelo botão "+ Horário". */
export function suggestNextTime(times: string[]): string {
  const candidates = ["08:00", "12:00", "19:00", "09:00", "15:00", "21:00", "10:00", "18:00"];
  return candidates.find((time) => !times.includes(time)) ?? "07:00";
}
