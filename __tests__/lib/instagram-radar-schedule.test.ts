// Radar Instagram — programação (lógica pura): 1–10/dia, intervalos, janela,
// fuso, compatibilidade, limite combinado por conta e prévia.
import { describe, expect, it } from "vitest";
import {
  RadarScheduleError,
  accountDailyCap,
  allocateRadarSlots,
  checkRadarFit,
  describeDailyTimes,
  estimateDaysToConsume,
  normalizeRadarSchedule,
  radarDailySlots,
  type RadarScheduleConfig,
} from "@/lib/instagram-radar/schedule";
import { appendHashtags, composeRadarCaption, needsCaptionReview, normalizeHashtags } from "@/lib/instagram-radar/captions";
import { utcToZonedInputs } from "@/lib/instagram/schedule-time";

const SP = "America/Sao_Paulo";
// Quarta-feira, 18/11/2026 06:00 em São Paulo (09:00 UTC).
const NOW = new Date("2026-11-18T09:00:00.000Z");

function config(overrides: Partial<RadarScheduleConfig> = {}): RadarScheduleConfig {
  return normalizeRadarSchedule({ timezone: SP, postsPerDay: 5, intervalMinutes: 120, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6], ...overrides });
}

const local = (date: Date, tz = SP) => {
  const parts = utcToZonedInputs(date, tz);
  return `${parts.date} ${parts.time}`;
};

describe("quantidade por dia (1 a 10)", () => {
  it("aceita 1 e 10; recusa 0, negativo, decimal e acima de 10", () => {
    expect(config({ postsPerDay: 1 }).postsPerDay).toBe(1);
    expect(config({ postsPerDay: 10, intervalMinutes: 60 }).postsPerDay).toBe(10);
    for (const bad of [0, -1, 2.5, 11, 24, "abc", null]) {
      expect(() => config({ postsPerDay: bad as number })).toThrow(/1 a 10/);
    }
  });

  it("intervalo só da lista fechada", () => {
    expect(() => config({ intervalMinutes: 45 as never })).toThrow(/Intervalo mínimo inválido/);
    expect(() => config({ intervalMinutes: 0 as never })).toThrow(/Intervalo mínimo inválido/);
  });
});

describe("horários calculados (quantidade + intervalo + horário inicial)", () => {
  it("exemplo do pedido: 5/dia, 2 h, início 9h → 9h, 11h, 13h, 15h, 17h", () => {
    const c = config();
    expect(radarDailySlots(c).map((slot) => slot.time)).toEqual(["09:00", "11:00", "13:00", "15:00", "17:00"]);
    expect(describeDailyTimes(c)).toBe("9h, 11h, 13h, 15h e 17h");
    const { slots } = allocateRadarSlots({ config: c, now: NOW, occupied: [], count: 5, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot))).toEqual(["2026-11-18 09:00", "2026-11-18 11:00", "2026-11-18 13:00", "2026-11-18 15:00", "2026-11-18 17:00"]);
  });

  it.each([
    [30, ["09:00", "09:30", "10:00"]],
    [60, ["09:00", "10:00", "11:00"]],
    [120, ["09:00", "11:00", "13:00"]],
    [720, ["09:00", "21:00"]],
  ])("intervalo de %i min", (interval, times) => {
    const c = config({ postsPerDay: times.length, intervalMinutes: interval as RadarScheduleConfig["intervalMinutes"], windowEnd: "23:00" });
    expect(radarDailySlots(c).map((slot) => slot.time)).toEqual(times);
    const { slots } = allocateRadarSlots({ config: c, now: NOW, occupied: [], count: times.length * 2, accountDailyCap: 10 });
    for (let index = 1; index < slots.length; index += 1) {
      expect(slots[index].getTime() - slots[index - 1].getTime()).toBeGreaterThanOrEqual(interval * 60_000);
    }
  });

  it("1 por dia: um vídeo por dia no horário inicial", () => {
    const { slots } = allocateRadarSlots({ config: config({ postsPerDay: 1 }), now: NOW, occupied: [], count: 3, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot))).toEqual(["2026-11-18 09:00", "2026-11-19 09:00", "2026-11-20 09:00"]);
  });

  it("10 por dia com intervalo de 1 h cabe em 08h–22h", () => {
    const c = config({ postsPerDay: 10, intervalMinutes: 60, windowStart: "08:00" });
    const { slots } = allocateRadarSlots({ config: c, now: NOW, occupied: [], count: 10, accountDailyCap: 10 });
    expect(slots).toHaveLength(10);
    expect(local(slots[9])).toBe("2026-11-18 17:00");
  });
});

describe("configurações incompatíveis", () => {
  it("08h–22h, 10/dia a cada 2 h: recusa com mensagem clara e sugestões (sem reduzir o intervalo sozinho)", () => {
    let error: RadarScheduleError | null = null;
    try {
      config({ postsPerDay: 10, intervalMinutes: 120, windowStart: "08:00", windowEnd: "22:00" });
    } catch (caught) {
      error = caught as RadarScheduleError;
    }
    expect(error).toBeInstanceOf(RadarScheduleError);
    expect(error!.message).toMatch(/incompatível/);
    expect(error!.message).toMatch(/cabem no máximo 8/);
    expect(error!.suggestions.join(" ")).toMatch(/Diminuir para 8/);
    expect(error!.suggestions.join(" ")).toMatch(/1 hora/);
    expect(error!.suggestions.join(" ")).toMatch(/até as 02:00 \(do dia seguinte\)/);
  });

  it("N × intervalo acima de 24 h é recusado", () => {
    expect(checkRadarFit({ postsPerDay: 2, intervalMinutes: 1440, windowStart: "00:00", windowEnd: "00:00" }).ok).toBe(false);
    expect(checkRadarFit({ postsPerDay: 1, intervalMinutes: 1440, windowStart: "09:00", windowEnd: "09:00" }).ok).toBe(true);
  });

  it("horário inválido e nenhum dia escolhido", () => {
    expect(() => config({ windowStart: "25:00" })).toThrow(/Horário inicial inválido/);
    expect(() => config({ weekdays: [] })).toThrow(/pelo menos um dia/);
  });
});

describe("janela, dias e fuso", () => {
  it("janela que atravessa a meia-noite: 22h–02h, 3/dia a cada 2 h → 22h, 00h e 02h do dia seguinte", () => {
    const c = config({ postsPerDay: 3, intervalMinutes: 120, windowStart: "22:00", windowEnd: "02:00" });
    expect(radarDailySlots(c)).toEqual([
      { time: "22:00", dayOffset: 0 },
      { time: "00:00", dayOffset: 1 },
      { time: "02:00", dayOffset: 1 },
    ]);
    const { slots } = allocateRadarSlots({ config: c, now: NOW, occupied: [], count: 4, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot))).toEqual(["2026-11-18 22:00", "2026-11-19 00:00", "2026-11-19 02:00", "2026-11-19 22:00"]);
  });

  it("dias da semana: o dia é o do INÍCIO da janela", () => {
    // 18/11/2026 é quarta (3). Só sextas (5).
    const { slots } = allocateRadarSlots({ config: config({ postsPerDay: 1, weekdays: [5] }), now: NOW, occupied: [], count: 2, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot))).toEqual(["2026-11-20 09:00", "2026-11-27 09:00"]);
  });

  it("fuso: 09h em São Paulo = 12h UTC; 09h em Lisboa = 09h UTC", () => {
    const sp = allocateRadarSlots({ config: config({ postsPerDay: 1 }), now: NOW, occupied: [], count: 1, accountDailyCap: 10 });
    expect(sp.slots[0].toISOString()).toBe("2026-11-18T12:00:00.000Z");
    const lisbon = allocateRadarSlots({ config: config({ postsPerDay: 1, timezone: "Europe/Lisbon" }), now: new Date("2026-11-18T05:00:00Z"), occupied: [], count: 1, accountDailyCap: 10 });
    expect(lisbon.slots[0].toISOString()).toBe("2026-11-18T09:00:00.000Z");
  });

  it("horário de verão (Nova York, 08/03/2026): 09h local continua 09h local", () => {
    const c = config({ postsPerDay: 1, timezone: "America/New_York" });
    const { slots } = allocateRadarSlots({ config: c, now: new Date("2026-03-07T00:00:00Z"), occupied: [], count: 3, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot, "America/New_York"))).toEqual(["2026-03-07 09:00", "2026-03-08 09:00", "2026-03-09 09:00"]);
    expect(slots[0].toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(slots[1].toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  it("data de início no futuro e nunca no passado", () => {
    const { slots } = allocateRadarSlots({ config: config({ postsPerDay: 2, startDate: "2026-11-25" }), now: NOW, occupied: [], count: 2, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot))).toEqual(["2026-11-25 09:00", "2026-11-25 11:00"]);
    const late = allocateRadarSlots({ config: config(), now: new Date("2026-11-18T16:30:00Z"), occupied: [], count: 2, accountDailyCap: 10 });
    expect(local(late.slots[0])).toBe("2026-11-18 15:00");
  });
});

describe("limite por conta e coordenação", () => {
  it("teto combinado = menor limite entre os radares ativos da conta (nunca acima de 10)", () => {
    expect(accountDailyCap([5, 3])).toBe(3);
    expect(accountDailyCap([])).toBe(10);
    expect(accountDailyCap([10, 10])).toBe(10);
  });

  it("publicações de outros radares/agendamentos contam no limite do dia da conta", () => {
    const c = config({ postsPerDay: 5 });
    const other = [new Date("2026-11-18T13:00:00Z"), new Date("2026-11-18T17:00:00Z"), new Date("2026-11-18T21:00:00Z")].map((at) => ({ at, own: false }));
    const { slots, skipped } = allocateRadarSlots({ config: c, now: NOW, occupied: other, count: 5, accountDailyCap: 3 });
    // Dia 18 já tem 3 publicações da conta (teto 3): o radar só começa no dia 19.
    expect(slots.map((slot) => local(slot)).every((value) => value.startsWith("2026-11-19") || value.startsWith("2026-11-20"))).toBe(true);
    expect(skipped.some((entry) => entry.reason === "ACCOUNT_DAILY_LIMIT")).toBe(true);
  });

  it("horário a menos do intervalo de outra publicação é PULADO (não deslocado)", () => {
    const c = config({ postsPerDay: 3, intervalMinutes: 120 });
    // Outra publicação às 10h (local): 09h e 11h ficam a 1 h dela → pulados.
    const other = [{ at: new Date("2026-11-18T13:00:00Z"), own: false }];
    const { slots, skipped } = allocateRadarSlots({ config: c, now: NOW, occupied: other, count: 1, accountDailyCap: 10 });
    expect(local(slots[0])).toBe("2026-11-18 13:00");
    expect(skipped.map((entry) => [local(entry.at), entry.reason])).toEqual([
      ["2026-11-18 09:00", "INTERVAL_CONFLICT"],
      ["2026-11-18 11:00", "INTERVAL_CONFLICT"],
    ]);
  });

  it("publicações já agendadas pelo próprio radar contam no limite e não são repetidas", () => {
    const c = config({ postsPerDay: 2 });
    const own = [{ at: new Date("2026-11-18T12:00:00Z"), own: true }];
    const { slots } = allocateRadarSlots({ config: c, now: NOW, occupied: own, count: 2, accountDailyCap: 10 });
    expect(slots.map((slot) => local(slot))).toEqual(["2026-11-18 11:00", "2026-11-19 09:00"]);
  });
});

describe("prévia e legendas", () => {
  it("30 vídeos, 3/dia a cada 4 h a partir das 9h → 9h, 13h, 17h e 10 dias", () => {
    const c = config({ postsPerDay: 3, intervalMinutes: 240 });
    expect(describeDailyTimes(c)).toBe("9h, 13h e 17h");
    const { slots } = allocateRadarSlots({ config: c, now: new Date("2026-11-18T03:00:00Z"), occupied: [], count: 30, accountDailyCap: 10 });
    expect(estimateDaysToConsume(slots, SP)).toBe(10);
  });

  it("hashtags normalizadas e sem repetição; legenda própria tem prioridade", () => {
    expect(normalizeHashtags("gta6, #GTA6 #games  #games")).toBe("#gta6 #GTA6 #games");
    expect(appendHashtags("Texto #games", "#games #gta6")).toBe("Texto #games\n\n#gta6");
    expect(composeRadarCaption({ ownCaption: "Minha legenda", title: "x", template: "{titulo}", hashtags: "#a", radarName: "R", numero: 1, total: 2 })).toBe("Minha legenda\n\n#a");
    expect(composeRadarCaption({ ownCaption: null, title: "Corrida na praia", template: "{titulo} ({numero}/{total})", hashtags: "", radarName: "R", numero: 1, total: 2 })).toBe("Corrida na praia (1/2)");
  });

  it("regra de revisão: sem legenda própria, o vídeo espera revisão", () => {
    expect(needsCaptionReview("REVIEW", null)).toBe(true);
    expect(needsCaptionReview("REVIEW", "ok")).toBe(false);
    expect(needsCaptionReview("DEFAULT", null)).toBe(false);
  });
});
