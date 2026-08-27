import type { DayOfWeek } from './types';

/**
 * Ordem de exibição PT-BR (semana começa na segunda) — a Api usa a ordem
 * nativa do enum `System.DayOfWeek` do .NET (que começa no domingo), mas as
 * telas mostram segunda a domingo, exemplo do próprio PROMPT 07 ("Segunda:
 * ...; Terça: ...; Quarta: indisponível").
 */
export const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const DAY_OF_WEEK_LABEL: Record<DayOfWeek, string> = {
  Monday: 'Segunda-feira',
  Tuesday: 'Terça-feira',
  Wednesday: 'Quarta-feira',
  Thursday: 'Quinta-feira',
  Friday: 'Sexta-feira',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
};

export const MONTH_LABEL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * A Api usa `TimeOnly` (.NET), que exige o formato completo "HH:mm:ss" no
 * JSON — confirmado durante a implementação do backend: "08:00" sozinho
 * (sem segundos) não é aceito pelo desserializador padrão do .NET. As
 * telas só pedem "HH:MM" ao profissional (ninguém digita segundos numa
 * agenda); estas funções fazem a conversão nos dois sentidos para nunca
 * vazar esse detalhe de formato para os componentes de UI.
 */
export function toApiTime(hhmm: string): string {
  return `${hhmm}:00`;
}

export function fromApiTime(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "2026-08-27" → "27/08/2026" (React Native: BlockedDatesScreen — lista de
 * "Exceções cadastradas"). Mesma função de
 * `scheduling/schedulingFormat.ts#formatDateDisplay`, duplicada aqui pela
 * mesma razão dos demais formatadores deste arquivo (módulos não se
 * importam entre si).
 */
export function formatDateDisplay(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Máscara de data DD/MM/AAAA para o CAMPO DE DIGITAÇÃO de
 * BlockedDatesScreen (pedido explícito: "arrumar a data aqui para
 * dia/mês/ano" — não só a listagem abaixo, o campo em si). Progressiva,
 * sem biblioteca externa (mesma técnica de `utils/phone.ts`): a pessoa só
 * digita números, as barras entram sozinhas.
 */
export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export const DATE_INPUT_PATTERN = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

/**
 * "27/08/2026" → "2026-08-27" — a Api só entende `DateOnly` no formato
 * ISO (`DATE_PATTERN`); esta função converte o que o campo mascarado
 * mostra para o que vai no corpo da requisição, só na hora de enviar
 * (`useAddAvailabilityException`).
 */
export function parseDateInput(ddmmyyyy: string): string {
  const [day, month, year] = ddmmyyyy.split('/');
  return `${year}-${month}-${day}`;
}

/**
 * Etapa 19 (agenda e disponibilidade) — períodos padrão "manhã/tarde/noite",
 * mesmos valores de `Alilu.Modules.Professional.Domain.ProfessionalAvailabilityPeriods`
 * (backend) — cópia intencional, mesma convenção de `DAY_OF_WEEK_LABEL`
 * acima (módulos/plataformas deste projeto não compartilham constantes):
 * mudar um valor aqui exige atualizar a cópia lá. Usado tanto pela tela
 * "Adicionar disponibilidade" (checkboxes de período) quanto por
 * `BlockedDatesScreen` (atalhos de período), que antes desta etapa usava
 * horários ligeiramente diferentes (08-12/13-18) — ajustados aqui para
 * bater com o backend.
 */
export const STANDARD_PERIODS: { key: 'morning' | 'afternoon' | 'evening'; label: string; startTime: string; endTime: string }[] = [
  { key: 'morning', label: 'Manhã', startTime: '07:00', endTime: '12:00' },
  { key: 'afternoon', label: 'Tarde', startTime: '12:00', endTime: '18:00' },
  { key: 'evening', label: 'Noite', startTime: '18:00', endTime: '22:00' },
];

/**
 * Atalhos de seleção de dias da semana (pedido explícito: "Segunda a
 * Sexta"/"Final de semana"/"Todos os dias") — React Native: tela "Adicionar
 * disponibilidade".
 */
export const WEEKDAY_SHORTCUTS: { key: string; label: string; days: DayOfWeek[] }[] = [
  { key: 'weekdays', label: 'Segunda a Sexta', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { key: 'weekend', label: 'Final de semana', days: ['Saturday', 'Sunday'] },
  { key: 'all', label: 'Todos os dias', days: [...DAY_OF_WEEK_ORDER] },
];

export type QuickDateRangeKey = 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth';

export const QUICK_DATE_RANGE_OPTIONS: { key: QuickDateRangeKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'tomorrow', label: 'Amanhã' },
  { key: 'thisWeek', label: 'Esta semana' },
  { key: 'nextWeek', label: 'Próxima semana' },
  { key: 'thisMonth', label: 'Este mês' },
  { key: 'nextMonth', label: 'Próximo mês' },
];

/**
 * Resolve um atalho de período (React Native: "Adicionar disponibilidade")
 * em `[from, to]` ("yyyy-MM-dd", mesmo formato de `DateOnly`) — usados como
 * `effectiveFrom`/`effectiveUntil` de `SetBulkAvailabilityPayload`. Semana
 * começa na segunda, mesma convenção de `buildMonthGrid`.
 */
export function resolveQuickDateRange(key: QuickDateRangeKey, referenceDate: Date = new Date()): { from: string; to: string } {
  switch (key) {
    case 'today':
      return { from: toDateString(referenceDate), to: toDateString(referenceDate) };
    case 'tomorrow': {
      const tomorrow = addDays(referenceDate, 1);
      return { from: toDateString(tomorrow), to: toDateString(tomorrow) };
    }
    case 'thisWeek': {
      const monday = startOfWeek(referenceDate);
      return { from: toDateString(monday), to: toDateString(addDays(monday, 6)) };
    }
    case 'nextWeek': {
      const nextMonday = addDays(startOfWeek(referenceDate), 7);
      return { from: toDateString(nextMonday), to: toDateString(addDays(nextMonday, 6)) };
    }
    case 'thisMonth': {
      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth();
      return { from: toDateString(new Date(year, month, 1)), to: toDateString(new Date(year, month + 1, 0)) };
    }
    case 'nextMonth': {
      const year = referenceDate.getFullYear();
      const month = referenceDate.getMonth() + 1;
      return { from: toDateString(new Date(year, month, 1)), to: toDateString(new Date(year, month + 1, 0)) };
    }
    default:
      return { from: toDateString(referenceDate), to: toDateString(referenceDate) };
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Segunda-feira da semana de `date` — mesma convenção "semana começa na segunda" de `buildMonthGrid`. */
function startOfWeek(date: Date): Date {
  const mondayBasedIndex = (date.getDay() + 6) % 7; // Date.getDay(): 0=domingo..6=sábado → 0=segunda..6=domingo.
  return addDays(date, -mondayBasedIndex);
}

export interface CalendarDay {
  /** "yyyy-MM-dd" — mesmo formato de `DateOnly` usado pela Api. */
  date: string;
  day: number;
  isCurrentMonth: boolean;
}

/**
 * Grade de mês (semanas de 7 dias, começando na segunda) para
 * CalendarAvailabilityScreen — calculada com `Date` nativo, sem nenhuma
 * biblioteca de datas (este projeto não usa uma até agora). Inclui dias de
 * preenchimento do mês anterior/seguinte para completar semanas inteiras.
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Date.getDay(): 0=domingo..6=sábado. Desloca para 0=segunda..6=domingo.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

  const cells: CalendarDay[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    cells.push({ date: toDateString(new Date(year, month - 1, day)), day, isCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toDateString(new Date(year, month, day)), day, isCurrentMonth: true });
  }

  let nextMonthDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: toDateString(new Date(year, month + 1, nextMonthDay)), day: nextMonthDay, isCurrentMonth: false });
    nextMonthDay += 1;
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
