import type { BookingStatus } from './types';

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  Requested: 'Solicitado',
  Confirmed: 'Confirmado',
  Rejected: 'Recusado',
  CancelledByResident: 'Cancelado pelo morador',
  CancelledByProfessional: 'Cancelado pelo profissional',
  InProgress: 'Em andamento',
  Completed: 'Concluído',
  NoShow: 'Não compareceu',
};

/**
 * Etapa 20 (modernização visual) — tom do `Badge` (componente compartilhado
 * em `components/Badge.tsx`) para cada status, usado em
 * MyBookingsScreen/ProfessionalRequestsScreen/BookingDetailsScreen no lugar
 * do rótulo em texto puro sem nenhum destaque visual.
 */
export const BOOKING_STATUS_TONE: Record<BookingStatus, 'success' | 'accent' | 'error' | 'info' | 'neutral'> = {
  Requested: 'accent',
  Confirmed: 'info',
  Rejected: 'error',
  CancelledByResident: 'neutral',
  CancelledByProfessional: 'neutral',
  InProgress: 'info',
  Completed: 'success',
  NoShow: 'error',
};

/**
 * A Api usa `TimeOnly` (.NET), que exige o formato completo "HH:mm:ss" no
 * JSON — mesma observação de `professional/availabilityFormat.ts`
 * (Etapa 07). As telas deste módulo só pedem "HH:MM" ao morador; estas
 * funções fazem a conversão nos dois sentidos para nunca vazar esse
 * detalhe de formato para os componentes de UI.
 */
export function toApiTime(hhmm: string): string {
  return `${hhmm}:00`;
}

export function fromApiTime(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export interface CalendarDay {
  /** "yyyy-MM-dd" — mesmo formato de `DateOnly` usado pela Api. */
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isPast: boolean;
}

/**
 * Grade de mês (semanas de 7 dias, começando na segunda) para
 * DateSelectionScreen — mesma lógica de `professional/availabilityFormat.ts#buildMonthGrid`
 * (Etapa 07), duplicada aqui pelo mesmo motivo das demais estruturas deste
 * arquivo (módulos não importam uns dos outros). A única diferença é
 * `isPast`: o morador não pode escolher uma data já passada ("nunca
 * confiar no calendário do React Native" também vale aqui — o servidor
 * não valida "data no passado" explicitamente, mas a checagem de
 * disponibilidade e de conflito naturalmente rejeitam horários que não
 * fazem sentido; ainda assim a tela evita oferecer a opção).
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[][] {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayString = toDateString(new Date());

  // Date.getDay(): 0=domingo..6=sábado. Desloca para 0=segunda..6=domingo.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;

  const cells: CalendarDay[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const date = toDateString(new Date(year, month - 1, day));
    cells.push({ date, day, isCurrentMonth: false, isPast: date < todayString });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toDateString(new Date(year, month, day));
    cells.push({ date, day, isCurrentMonth: true, isPast: date < todayString });
  }

  let nextMonthDay = 1;
  while (cells.length % 7 !== 0) {
    const date = toDateString(new Date(year, month + 1, nextMonthDay));
    cells.push({ date, day: nextMonthDay, isCurrentMonth: false, isPast: date < todayString });
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

/** "2026-08-25" → "25/08/2026" (React Native: exibição em MyBookingsScreen/BookingDetailsScreen/BookingConfirmationScreen). */
export function formatDateDisplay(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** "09:00:00" + "10:00:00" → "09:00 - 10:00". Aceita tanto "HH:mm:ss" (vindo da Api) quanto "HH:MM" (formulário) — sempre corta para 5 caracteres. */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime.slice(0, 5)} - ${endTime.slice(0, 5)}`;
}
