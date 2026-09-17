/**
 * Lógica de cálculo da Calculadora de Dias Úteis, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side.
 *
 * REGRA ESPECIAL (feriados): o projeto NÃO afirma considerar feriados
 * estaduais ou municipais — não existe uma fonte única e confiável para
 * todos os ~5.570 municípios brasileiros. Apenas os feriados NACIONAIS,
 * fixados por lei federal, são considerados, e a lista exata usada é
 * exibida ao usuário (ver `NATIONAL_HOLIDAYS_EXPLANATION` e o retorno de
 * `getNationalHolidays`), conforme exigido pelo PROMPT MESTRE ("dias
 * úteis").
 *
 * Feriados nacionais fixos (data igual todo ano), por lei federal:
 *   1º de janeiro   — Confraternização Universal (Lei nº 662/1949)
 *   21 de abril      — Tiradentes (Lei nº 662/1949)
 *   1º de maio       — Dia do Trabalho (Lei nº 662/1949)
 *   7 de setembro    — Independência do Brasil (Lei nº 662/1949)
 *   12 de outubro    — Nossa Senhora Aparecida (Lei nº 6.802/1980)
 *   2 de novembro    — Finados (Lei nº 662/1949)
 *   15 de novembro   — Proclamação da República (Lei nº 662/1949)
 *   20 de novembro   — Dia Nacional de Zumbi e da Consciência Negra
 *                       (Lei nº 14.759/2023 — feriado nacional a partir de 2024)
 *   25 de dezembro   — Natal (Lei nº 662/1949)
 *
 * Feriados nacionais móveis (dependem da data da Páscoa, calculada pelo
 * algoritmo computacional de Gauss/Meeus — não é uma regra que "muda": é
 * uma fórmula astronômica/calendárica fixa, não uma lei sujeita a alteração):
 *   Sexta-feira Santa — Páscoa - 2 dias
 *   Corpus Christi    — Páscoa + 60 dias (feriado nacional por tradição/uso
 *                        consolidado no calendário oficial, embora não haja
 *                        uma única lei federal específica — por isso pode
 *                        ser desativado)
 *
 * CARNAVAL NÃO É FERIADO NACIONAL: a terça-feira e a quarta-feira de cinzas
 * são "ponto facultativo" (Lei nº 662/1949 e decretos anuais do governo
 * federal para o funcionalismo público), não feriado nacional obrigatório —
 * o comércio, a indústria e a maioria das empresas privadas não são
 * obrigados a dispensar o expediente. Por isso o Carnaval NÃO entra na lista
 * padrão de feriados nacionais desta calculadora.
 *
 * Nenhum feriado estadual, municipal, ponto facultativo (incluindo o
 * Carnaval) ou emenda de feriado é considerado.
 */

export interface BusinessDaysInput {
  /** Data inicial, no formato "YYYY-MM-DD" (valor nativo de <input type="date">). */
  startDate: string;
  /** Data final, no formato "YYYY-MM-DD". */
  endDate: string;
  /** Se a data inicial deve ser incluída na contagem. */
  includeStartDate: boolean;
  /** Se os feriados nacionais fixos/móveis devem ser descontados dos dias úteis. */
  considerHolidays: boolean;
  /** Se o Corpus Christi (uso consolidado, não fixado em lei federal única) deve ser considerado. */
  considerCorpusChristi: boolean;
}

export interface BusinessDaysFieldErrors {
  startDate?: string;
  endDate?: string;
}

export interface BusinessDaysResult {
  /** Dias úteis no período — resultado principal. */
  headline: number;
  totalDays: number;
  saturdays: number;
  sundays: number;
  holidaysCount: number;
  /** Datas (YYYY-MM-DD) dos feriados nacionais considerados que caíram em dia útil (não fim de semana). */
  holidayDates: string[];
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Valida datas "inventadas" como 2024-02-30, que o construtor do Date
  // silenciosamente rola para o mês seguinte.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Domingo de Páscoa de um ano, pelo algoritmo de Gauss/Meeus (cálculo, não dado que muda por lei). */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Feriados nacionais considerados por esta calculadora, para um ano
 * específico. Ver a documentação no topo do arquivo para a lista completa e
 * as fontes legais de cada um.
 */
export function getNationalHolidays(
  year: number,
  considerCorpusChristi: boolean
): string[] {
  const easter = getEasterSunday(year);

  const fixed = [
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
  ];

  const movable = [
    toISODate(addDaysUTC(easter, -2)), // Sexta-feira Santa
  ];

  if (considerCorpusChristi) {
    movable.push(toISODate(addDaysUTC(easter, 60)));
  }

  return [...fixed, ...movable];
}

export function validateBusinessDaysInput(
  input: BusinessDaysInput
): BusinessDaysFieldErrors {
  const errors: BusinessDaysFieldErrors = {};

  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);

  if (!start) {
    errors.startDate = "Informe uma data inicial válida.";
  }
  if (!end) {
    errors.endDate = "Informe uma data final válida.";
  }
  if (start && end && end.getTime() < start.getTime()) {
    errors.endDate = "A data final não pode ser anterior à data inicial.";
  }

  return errors;
}

export function isBusinessDaysInputValid(input: BusinessDaysInput): boolean {
  return Object.keys(validateBusinessDaysInput(input)).length === 0;
}

/**
 * Calcula dias corridos, dias úteis, sábados, domingos e feriados nacionais
 * entre duas datas (ambas inclusive, exceto a inicial quando
 * `includeStartDate` for false). Assume que `input` já foi validado (ver
 * validateBusinessDaysInput).
 */
export function calculateBusinessDays(
  input: BusinessDaysInput
): BusinessDaysResult {
  const start = parseDateOnly(input.startDate)!;
  const end = parseDateOnly(input.endDate)!;

  const holidaySet = new Set<string>();
  if (input.considerHolidays) {
    for (
      let year = start.getUTCFullYear();
      year <= end.getUTCFullYear();
      year += 1
    ) {
      for (const holiday of getNationalHolidays(year, input.considerCorpusChristi)) {
        holidaySet.add(holiday);
      }
    }
  }

  let totalDays = 0;
  let businessDays = 0;
  let saturdays = 0;
  let sundays = 0;
  const holidayDates: string[] = [];

  const firstDay = input.includeStartDate ? start : addDaysUTC(start, 1);

  for (
    let cursor = firstDay;
    cursor.getTime() <= end.getTime();
    cursor = addDaysUTC(cursor, 1)
  ) {
    totalDays += 1;
    const weekday = cursor.getUTCDay(); // 0 = domingo, 6 = sábado
    const iso = toISODate(cursor);
    const isHoliday = holidaySet.has(iso);

    if (weekday === 0) {
      sundays += 1;
    } else if (weekday === 6) {
      saturdays += 1;
    } else if (isHoliday) {
      holidayDates.push(iso);
    } else {
      businessDays += 1;
    }
  }

  return {
    headline: businessDays,
    totalDays,
    saturdays,
    sundays,
    holidaysCount: holidayDates.length,
    holidayDates,
  };
}
