// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addMonthsAnchored, addDays, diffDays, isValidISODate, monthRange } from "@/lib/financas/dates";
import { expandOccurrences, occurrenceDates } from "@/lib/financas/recurrence";
import {
  bucketUpcoming,
  computeCanSpend,
  expensesByCategory,
  occurrenceStatus,
  projectCashFlow,
  summarizeMonth,
} from "@/lib/financas/summary";
import { parseEntryInput, parseSettingsInput, reaisTextToCents } from "@/lib/financas/validation";
import type { FinEntry } from "@/lib/financas/types";

function entry(partial: Partial<FinEntry> & Pick<FinEntry, "id" | "kind" | "amountCents" | "date">): FinEntry {
  return {
    description: partial.id,
    category: partial.kind === "income" ? "Salário" : "Moradia",
    nature: partial.kind === "expense" ? "fixed" : null,
    recurrence: "none",
    recurrenceEnd: null,
    paymentMethod: null,
    note: null,
    paidAt: null,
    ...partial,
  };
}

describe("datas", () => {
  it("valida datas reais", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("26-01-01")).toBe(false);
  });
  it("soma meses mantendo o dia âncora", () => {
    expect(addMonthsAnchored("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsAnchored("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsAnchored("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsAnchored("2024-02-29", 12)).toBe("2025-02-28");
  });
  it("calcula dias e intervalos", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(diffDays("2026-09-25", "2026-09-30")).toBe(5);
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("recorrência", () => {
  it("lançamento único só aparece no mês certo", () => {
    const e = entry({ id: "a", kind: "expense", amountCents: 100, date: "2026-09-10" });
    expect(occurrenceDates(e, "2026-09-01", "2026-09-30")).toEqual(["2026-09-10"]);
    expect(occurrenceDates(e, "2026-10-01", "2026-10-31")).toEqual([]);
  });
  it("mensal aparece em cada mês a partir da 1ª data, com ajuste de fim de mês", () => {
    const e = entry({ id: "a", kind: "expense", amountCents: 100, date: "2026-01-31", recurrence: "monthly" });
    expect(occurrenceDates(e, "2026-02-01", "2026-02-28")).toEqual(["2026-02-28"]);
    expect(occurrenceDates(e, "2026-03-01", "2026-03-31")).toEqual(["2026-03-31"]);
    expect(occurrenceDates(e, "2025-12-01", "2025-12-31")).toEqual([]);
  });
  it("semanal e quinzenal", () => {
    const w = entry({ id: "w", kind: "income", amountCents: 100, date: "2026-09-04", recurrence: "weekly" });
    expect(occurrenceDates(w, "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-04",
      "2026-09-11",
      "2026-09-18",
      "2026-09-25",
    ]);
    const b = entry({ id: "b", kind: "income", amountCents: 100, date: "2026-08-07", recurrence: "biweekly" });
    expect(occurrenceDates(b, "2026-09-01", "2026-09-30")).toEqual(["2026-09-04", "2026-09-18"]);
  });
  it("anual e data final", () => {
    const y = entry({ id: "y", kind: "expense", amountCents: 100, date: "2024-03-10", recurrence: "yearly" });
    expect(occurrenceDates(y, "2026-03-01", "2026-03-31")).toEqual(["2026-03-10"]);
    expect(occurrenceDates(y, "2026-04-01", "2026-04-30")).toEqual([]);
    const ended = entry({
      id: "e",
      kind: "expense",
      amountCents: 100,
      date: "2026-01-05",
      recurrence: "monthly",
      recurrenceEnd: "2026-03-05",
    });
    expect(occurrenceDates(ended, "2026-04-01", "2026-04-30")).toEqual([]);
    expect(occurrenceDates(ended, "2026-03-01", "2026-03-31")).toEqual(["2026-03-05"]);
  });
  it("marca pagamento por ocorrência em recorrentes e por lançamento nos únicos", () => {
    const rec = entry({ id: "r", kind: "expense", amountCents: 500, date: "2026-08-05", recurrence: "monthly" });
    const one = entry({ id: "o", kind: "expense", amountCents: 700, date: "2026-09-07", paidAt: "2026-09-07T10:00:00Z" });
    const occ = expandOccurrences(
      [rec, one],
      [{ entryId: "r", date: "2026-08-05", paidAt: "2026-08-05T10:00:00Z" }],
      "2026-08-01",
      "2026-09-30",
    );
    expect(occ.map((o) => [o.entryId, o.date, o.paid])).toEqual([
      ["r", "2026-08-05", true],
      ["r", "2026-09-05", false],
      ["o", "2026-09-07", true],
    ]);
  });
});

describe("resumo do mês, saldo e situação", () => {
  const entries = [
    entry({ id: "salario", kind: "income", amountCents: 800000, date: "2026-09-05", paidAt: "2026-09-05T09:00:00Z" }),
    entry({ id: "escola", kind: "expense", amountCents: 150000, date: "2026-09-05", paidAt: "2026-09-05T09:00:00Z" }),
    entry({ id: "cartao", kind: "expense", amountCents: 210000, date: "2026-09-08" }),
    entry({ id: "condominio", kind: "expense", amountCents: 85000, date: "2026-09-28" }),
    entry({ id: "extra", kind: "income", amountCents: 50000, date: "2026-09-27" }),
  ];
  const occ = expandOccurrences(entries, [], "2026-09-01", "2026-09-30");
  const today = "2026-09-25";

  it("calcula totais, vencidas, a vencer e projeção", () => {
    const s = summarizeMonth(occ, { today });
    expect(s.incomeTotalCents).toBe(850000);
    expect(s.incomeReceivedCents).toBe(800000);
    expect(s.expenseTotalCents).toBe(445000);
    expect(s.expensePaidCents).toBe(150000);
    expect(s.expenseOverdueCents).toBe(210000); // cartão venceu dia 8 e não foi pago
    expect(s.expenseUpcomingCents).toBe(85000);
    expect(s.balanceNowCents).toBe(650000);
    expect(s.availableCents).toBe(405000);
    expect(s.projectedEndCents).toBe(650000 + 50000 - 85000 - 210000);
    expect(s.state).toBe("attention"); // há conta vencida
  });

  it("considera saldo inicial e meta de economia", () => {
    const s = summarizeMonth(occ, { today, openingBalanceCents: 100000, savingsGoalCents: 100000 });
    expect(s.balanceNowCents).toBe(750000);
    expect(s.projectedEndCents).toBe(505000);
    expect(s.freeToSpendCents).toBe(405000);
  });

  it("estado 'over' quando a projeção fica negativa e 'ok' quando tudo em dia", () => {
    const negative = summarizeMonth(
      expandOccurrences(
        [
          entry({ id: "i", kind: "income", amountCents: 1000, date: "2026-09-01", paidAt: "x" }),
          entry({ id: "e", kind: "expense", amountCents: 5000, date: "2026-09-29" }),
        ],
        [],
        "2026-09-01",
        "2026-09-30",
      ),
      { today },
    );
    expect(negative.state).toBe("over");

    const ok = summarizeMonth(
      expandOccurrences(
        [
          entry({ id: "i", kind: "income", amountCents: 100000, date: "2026-09-01", paidAt: "x" }),
          entry({ id: "e", kind: "expense", amountCents: 5000, date: "2026-09-29" }),
        ],
        [],
        "2026-09-01",
        "2026-09-30",
      ),
      { today, savingsGoalCents: 10000 },
    );
    expect(ok.state).toBe("ok");
  });

  it("classifica situação de cada ocorrência", () => {
    const statuses = Object.fromEntries(occ.map((o) => [o.entryId, occurrenceStatus(o, today)]));
    expect(statuses).toEqual({
      salario: "income-received",
      escola: "paid",
      cartao: "overdue",
      condominio: "pending",
      extra: "income",
    });
  });

  it("agrupa próximas contas", () => {
    const b = bucketUpcoming(occ, today);
    expect(b.overdue.map((o) => o.entryId)).toEqual(["cartao"]);
    expect(b.next7.map((o) => o.entryId)).toEqual(["condominio"]);
    expect(b.today).toEqual([]);
  });
});

describe("quanto posso gastar", () => {
  const base = summarizeMonth([], { today: "2026-09-16", savingsGoalCents: 0 });
  it("divide o saldo livre pelos dias restantes (hoje incluso)", () => {
    const s = { ...base, freeToSpendCents: 90000 };
    const r = computeCanSpend(s, "2026-09", "2026-09-16"); // 16..30 = 15 dias
    expect(r.daysLeft).toBe(15);
    expect(r.perDayCents).toBe(6000);
  });
  it("não sugere valor negativo e trata mês passado/futuro", () => {
    expect(computeCanSpend({ ...base, freeToSpendCents: -500 }, "2026-09", "2026-09-16").perDayCents).toBe(0);
    expect(computeCanSpend({ ...base, freeToSpendCents: 100 }, "2026-08", "2026-09-16").daysLeft).toBe(0);
    expect(computeCanSpend({ ...base, freeToSpendCents: 3000 }, "2026-10", "2026-09-16").daysLeft).toBe(31);
  });
});

describe("fluxo de caixa", () => {
  it("projeta o saldo dia a dia e joga vencidas para hoje", () => {
    const occ = expandOccurrences(
      [
        entry({ id: "atrasada", kind: "expense", amountCents: 1000, date: "2026-09-20" }),
        entry({ id: "futura", kind: "expense", amountCents: 2000, date: "2026-09-27" }),
        entry({ id: "renda", kind: "income", amountCents: 5000, date: "2026-09-28" }),
        entry({ id: "paga", kind: "expense", amountCents: 9999, date: "2026-09-26", paidAt: "x" }),
      ],
      [],
      "2026-09-01",
      "2026-09-30",
    );
    const points = projectCashFlow({ startingBalanceCents: 10000, occurrences: occ, today: "2026-09-25", days: 5 });
    expect(points.map((p) => p.balanceCents)).toEqual([9000, 9000, 7000, 12000, 12000]);
    expect(points[0].date).toBe("2026-09-25");
  });
});

describe("gastos por categoria", () => {
  it("soma por categoria e calcula % da renda", () => {
    const occ = expandOccurrences(
      [
        entry({ id: "a", kind: "expense", amountCents: 250000, date: "2026-09-05", category: "Moradia" }),
        entry({ id: "b", kind: "expense", amountCents: 120000, date: "2026-09-06", category: "Alimentação" }),
        entry({ id: "c", kind: "expense", amountCents: 10000, date: "2026-09-07", category: "Alimentação" }),
      ],
      [],
      "2026-09-01",
      "2026-09-30",
    );
    expect(expensesByCategory(occ, 800000)).toEqual([
      { category: "Moradia", totalCents: 250000, percentOfIncome: 31.3 },
      { category: "Alimentação", totalCents: 130000, percentOfIncome: 16.3 },
    ]);
  });
});

describe("validação", () => {
  const valid = {
    kind: "expense",
    description: " Mercado ",
    amountCents: 12345,
    category: "Alimentação",
    date: "2026-09-25",
  };
  it("aceita lançamento válido e normaliza", () => {
    const r = parseEntryInput(valid);
    expect(r.ok && r.value).toMatchObject({ description: "Mercado", nature: "variable", recurrence: "none", paid: false });
  });
  it("rejeita valor, categoria, data e recorrência inválidos", () => {
    expect(parseEntryInput({ ...valid, amountCents: 0 }).ok).toBe(false);
    expect(parseEntryInput({ ...valid, amountCents: 10.5 }).ok).toBe(false);
    expect(parseEntryInput({ ...valid, category: "Salário" }).ok).toBe(false);
    expect(parseEntryInput({ ...valid, date: "2026-02-31" }).ok).toBe(false);
    expect(parseEntryInput({ ...valid, recurrence: "diaria" }).ok).toBe(false);
    expect(parseEntryInput({ ...valid, recurrence: "monthly", recurrenceEnd: "2026-01-01" }).ok).toBe(false);
    expect(parseEntryInput(null).ok).toBe(false);
  });
  it("receita não tem classificação fixa/variável", () => {
    const r = parseEntryInput({ kind: "income", description: "Salário", amountCents: 100, category: "Salário", date: "2026-09-05" });
    expect(r.ok && r.value.nature).toBeNull();
  });
  it("valida configurações", () => {
    expect(parseSettingsInput({ savingsGoalCents: 100000 }).ok).toBe(true);
    expect(parseSettingsInput({ savingsGoalCents: -1 }).ok).toBe(false);
    expect(parseSettingsInput({ openingBalanceCents: 100 }).ok).toBe(false); // falta o mês
    expect(parseSettingsInput({ openingBalanceCents: -500, month: "2026-09" }).ok).toBe(true);
  });
  it("converte texto em reais para centavos", () => {
    expect(reaisTextToCents("1.234,56")).toBe(123456);
    expect(reaisTextToCents("R$ 8.000")).toBe(800000);
    expect(reaisTextToCents("12,5")).toBe(1250);
    expect(reaisTextToCents("")).toBeNull();
    expect(reaisTextToCents("abc")).toBeNull();
  });
});
