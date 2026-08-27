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
 * "Exceções cadastradas"). O campo de digitação continua pedindo
 * "AAAA-MM-DD" (mesmo formato que a Api espera, `DATE_PATTERN`), mas a
 * listagem abaixo mostrava a data crua nesse formato — confuso para quem
 * está acostumado com dia/mês/ano. Mesma função de
 * `scheduling/schedulingFormat.ts#formatDateDisplay`, duplicada aqui pela
 * mesma razão dos demais formatadores deste arquivo (módulos não se
 * importam entre si).
 */
export function formatDateDisplay(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
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
