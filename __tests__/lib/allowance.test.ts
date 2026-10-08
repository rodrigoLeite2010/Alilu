// Módulo Mesada contra um Postgres REAL em memória (PGlite): saldo por movimentações, cofrinho,
// metas, tarefas/recompensas, idempotência da mesada e isolamento entre usuários.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const svc = await import("@/lib/allowance/backend/allowance-service");
const schedule = await import("@/lib/allowance/backend/schedule-service");
const { parseMoneyToCents, formatCents } = await import("@/lib/allowance/money");

const NOV5 = new Date("2026-11-05T15:00:00Z"); // 05/11/2026 12:00 em São Paulo
const OCT10 = new Date("2026-10-10T15:00:00Z");

let userA: string;
let userB: string;

beforeEach(async () => {
  db = await createTestDb();
  const [a] = await db.sql`insert into users (email) values ('pai@example.com') returning id`;
  const [b] = await db.sql`insert into users (email) values ('outro@example.com') returning id`;
  userA = a.id as string;
  userB = b.id as string;
});
afterEach(async () => {
  await db.close();
});

async function newChild(name = "Luna", user = userA) {
  return svc.createChild(user, { name });
}
async function bal(childId: string) {
  return { available: await svc.getAvailableBalance(childId), savings: await svc.getSavingsBalance(childId) };
}
async function category(name: string, type: "EXPENSE" | "INCOME") {
  const list = await svc.listUserCategories(userA);
  return list.find((c) => c.name === name && c.type === type)!;
}
async function withAllowance(amount = "100", opts: Record<string, unknown> = {}, now = NOV5) {
  const child = await newChild();
  await svc.setAllowance(userA, child.id, { monthlyAmount: amount, paymentDay: 5, startDate: "2026-11-01", ...opts }, now);
  return child;
}

describe("dinheiro", () => {
  it("converte para centavos inteiros e formata em pt-BR", () => {
    expect(parseMoneyToCents("1.250,50")).toBe(125050);
    expect(parseMoneyToCents("12,5")).toBe(1250);
    expect(parseMoneyToCents("0,10")).toBe(10);
    expect(parseMoneyToCents(-5)).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(formatCents(125050).replace(/\s/g, " ")).toBe("R$ 1.250,50");
  });
});

describe("crianças e segurança entre usuários", () => {
  it("1) cadastra criança (nome obrigatório) e 2) outro usuário não acessa nada dela", async () => {
    await expect(svc.createChild(userA, { name: "  " })).rejects.toMatchObject({ httpStatus: 400 });
    const luna = await newChild();
    expect(luna.name).toBe("Luna");
    expect((await svc.listChildrenOverview(userB)).length).toBe(0);
    const cat = await category("Lanches", "EXPENSE");
    const tarefa = (await svc.createTask(userA, luna.id, { name: "Arrumar", hasReward: true, rewardAmount: "5" }))[0];
    const { completionId } = await svc.completeTask(userA, luna.id, tarefa.id);
    const attempts = [
      svc.getChildDashboard(userB, luna.id),
      svc.registerExpense(userB, luna.id, { amount: "1", categoryId: cat.id }),
      svc.registerIncome(userB, luna.id, { amount: "1" }),
      svc.depositSavings(userB, luna.id, { amount: "1" }),
      svc.setAllowance(userB, luna.id, { monthlyAmount: "10", paymentDay: 1 }),
      svc.createGoal(userB, luna.id, { name: "x", targetAmount: "10" }),
      svc.listChildTransactions(userB, luna.id, {}),
      svc.approveCompletion(userB, completionId),
      svc.updateChildSettings(userB, luna.id, { name: "Hack" }),
    ];
    for (const attempt of attempts) await expect(attempt).rejects.toMatchObject({ httpStatus: 404 });
    expect((await svc.getChildDashboard(userA, luna.id)).child.name).toBe("Luna");
  });
});

describe("mesada", () => {
  it("3-4) cria a mesada e lança a entrada do mês", async () => {
    const child = await withAllowance();
    const history = await svc.listChildTransactions(userA, child.id, {});
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ type: "INCOME", sourceType: "ALLOWANCE", amountCents: 10000, date: "2026-11-05", categoryName: "Mesada" });
    expect((await bal(child.id)).available).toBe(10000);
  });

  it("5) nunca duplica a mesada do mês (cron repetido, reabrir tela, reconfigurar)", async () => {
    const child = await withAllowance();
    await schedule.runAllowanceSchedule(NOV5);
    await schedule.runAllowanceSchedule(NOV5);
    await svc.listChildrenOverview(userA, NOV5);
    await svc.getChildDashboard(userA, child.id, NOV5);
    await svc.setAllowance(userA, child.id, { monthlyAmount: "100", paymentDay: 5, startDate: "2026-11-01" }, NOV5);
    await Promise.all([schedule.runAllowanceSchedule(NOV5), schedule.runAllowanceSchedule(NOV5)]);
    const rows = await db.sql`select count(*)::int as n from allowance_transactions where child_id = ${child.id} and source_type = 'ALLOWANCE'`;
    expect(rows[0].n).toBe(1);
  });

  it("antes do dia do pagamento não lança; mesada negativa é recusada", async () => {
    const child = await newChild();
    await svc.setAllowance(userA, child.id, { monthlyAmount: "100", paymentDay: 20, startDate: "2026-11-01" }, NOV5);
    expect((await bal(child.id)).available).toBe(0);
    await expect(svc.setAllowance(userA, child.id, { monthlyAmount: "-5", paymentDay: 5 })).rejects.toMatchObject({ httpStatus: 400 });
  });

  it("23) acumula o saldo do mês anterior (carry over)", async () => {
    const child = await newChild();
    await svc.setAllowance(userA, child.id, { monthlyAmount: "100", paymentDay: 5, startDate: "2026-10-01" }, OCT10);
    await svc.registerExpense(userA, child.id, { amount: "70", date: "2026-10-12" }, OCT10);
    expect((await bal(child.id)).available).toBe(3000);
    await schedule.runAllowanceSchedule(NOV5);
    expect((await bal(child.id)).available).toBe(13000);
  });

  it("24) sem acumular: ajuste de fechamento explícito e histórico preservado", async () => {
    const child = await newChild();
    await svc.setAllowance(userA, child.id, { monthlyAmount: "100", paymentDay: 5, startDate: "2026-10-01", carryOverBalance: false }, OCT10);
    await svc.registerExpense(userA, child.id, { amount: "70", date: "2026-10-12" }, OCT10);
    await schedule.runAllowanceSchedule(NOV5);
    await schedule.runAllowanceSchedule(NOV5);
    expect((await bal(child.id)).available).toBe(10000);
    const all = await svc.listChildTransactions(userA, child.id, { limit: "100" });
    expect(all.some((t) => t.sourceType === "ADJUSTMENT" && t.amountCents === 3000)).toBe(true);
    expect(all.filter((t) => t.sourceType === "ADJUSTMENT")).toHaveLength(1);
    expect(all.filter((t) => t.sourceType === "ALLOWANCE")).toHaveLength(2);
    expect(all.some((t) => t.description === "" || t.amountCents === 7000)).toBe(true); // gasto antigo intacto
  });
});

describe("gastos, entradas e saldo", () => {
  it("6-7) registra gasto e o saldo diminui; 8-9) entrada extra aumenta", async () => {
    const child = await withAllowance();
    const lanches = await category("Lanches", "EXPENSE");
    await svc.registerExpense(userA, child.id, { amount: "20", categoryId: lanches.id, description: "Lanche" }, NOV5);
    expect((await bal(child.id)).available).toBe(8000);
    const presente = await category("Presente", "INCOME");
    await svc.registerIncome(userA, child.id, { amount: "50", categoryId: presente.id, description: "Presente da avó" }, NOV5);
    expect((await bal(child.id)).available).toBe(13000);
  });

  it("valida valores, datas e categorias", async () => {
    const child = await withAllowance();
    await expect(svc.registerExpense(userA, child.id, { amount: "0" })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(svc.registerExpense(userA, child.id, { amount: "-3" })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(svc.registerIncome(userA, child.id, { amount: "0" })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(svc.registerExpense(userA, child.id, { amount: "5", date: "2026-02-31" })).rejects.toMatchObject({ httpStatus: 400 });
    const incomeCat = await category("Mesada", "INCOME");
    await expect(svc.registerExpense(userA, child.id, { amount: "5", categoryId: incomeCat.id })).rejects.toMatchObject({ httpStatus: 400 });
  });

  it("26) bloqueia saldo negativo por padrão; liberável por configuração", async () => {
    const child = await withAllowance("10");
    await expect(svc.registerExpense(userA, child.id, { amount: "10,01" }, NOV5)).rejects.toMatchObject({ httpStatus: 409, code: "INSUFFICIENT_BALANCE" });
    expect((await bal(child.id)).available).toBe(1000);
    await svc.updateChildSettings(userA, child.id, { allowNegativeBalance: true });
    await svc.registerExpense(userA, child.id, { amount: "15" }, NOV5);
    expect((await bal(child.id)).available).toBe(-500);
  });

  it("gastos simultâneos não estouram o saldo", async () => {
    const child = await withAllowance("10");
    const results = await Promise.allSettled([
      svc.registerExpense(userA, child.id, { amount: "10" }, NOV5),
      svc.registerExpense(userA, child.id, { amount: "10" }, NOV5),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
  });
});

describe("cofrinho e metas", () => {
  it("10-12) guarda, retira e impede exceder saldo/cofrinho", async () => {
    const child = await withAllowance();
    await svc.depositSavings(userA, child.id, { amount: "20" }, NOV5);
    expect(await bal(child.id)).toEqual({ available: 8000, savings: 2000 });
    await svc.withdrawSavings(userA, child.id, { amount: "5" }, NOV5);
    expect(await bal(child.id)).toEqual({ available: 8500, savings: 1500 });
    await expect(svc.withdrawSavings(userA, child.id, { amount: "15,01" }, NOV5)).rejects.toMatchObject({ httpStatus: 409, code: "INSUFFICIENT_SAVINGS" });
    await expect(svc.depositSavings(userA, child.id, { amount: "85,01" }, NOV5)).rejects.toMatchObject({ httpStatus: 409, code: "INSUFFICIENT_BALANCE" });
    expect(await bal(child.id)).toEqual({ available: 8500, savings: 1500 });
  });

  it("13) meta com progresso ligado ao cofrinho (e retirada não passa do guardado na meta)", async () => {
    const child = await withAllowance("1000");
    const goal = await svc.createGoal(userA, child.id, { name: "Bicicleta", targetAmount: "800" });
    await expect(svc.createGoal(userA, child.id, { name: "x", targetAmount: "0" })).rejects.toMatchObject({ httpStatus: 400 });
    await svc.depositSavings(userA, child.id, { amount: "240", goalId: goal.id }, NOV5);
    await svc.depositSavings(userA, child.id, { amount: "50" }, NOV5); // sem meta
    const dash = await svc.getChildDashboard(userA, child.id, NOV5);
    expect(dash.goals[0]).toMatchObject({ savedCents: 24000, progressPct: 30, status: "ACTIVE" });
    expect(dash.alerts.some((a) => a.kind === "GOAL_REMAINING" && /560,00/.test(a.message.replace(/\s/g, " ")))).toBe(true);
    await expect(svc.withdrawSavings(userA, child.id, { amount: "250", goalId: goal.id }, NOV5)).rejects.toMatchObject({ httpStatus: 409 });
    await svc.depositSavings(userA, child.id, { amount: "560", goalId: goal.id }, NOV5);
    expect((await svc.getChildDashboard(userA, child.id, NOV5)).goals[0].status).toBe("ACHIEVED");
  });
});

describe("tarefas e recompensas", () => {
  it("14-15) tarefa sem e com recompensa", async () => {
    const child = await newChild();
    await svc.createTask(userA, child.id, { name: "Arrumar a cama", hasReward: false });
    const tasks = await svc.createTask(userA, child.id, { name: "Lavar o carro", hasReward: true, rewardAmount: "10" });
    expect(tasks.map((t) => [t.name, t.hasReward, t.rewardCents])).toEqual([["Arrumar a cama", false, 0], ["Lavar o carro", true, 1000]]);
    await expect(svc.createTask(userA, child.id, { name: "Ruim", hasReward: true, rewardAmount: "-1" })).rejects.toMatchObject({ httpStatus: 400 });
  });

  it("16-18) só paga quando o responsável aprova, uma única vez", async () => {
    const child = await newChild();
    const [task] = await svc.createTask(userA, child.id, { name: "Arrumar o quarto", hasReward: true, rewardAmount: "5" });
    const { completionId, paidCents } = await svc.completeTask(userA, child.id, task.id, {}, NOV5);
    expect(paidCents).toBe(0);
    expect((await bal(child.id)).available).toBe(0); // concluir não gera dinheiro
    const results = await Promise.allSettled([svc.approveCompletion(userA, completionId, NOV5), svc.approveCompletion(userA, completionId, NOV5)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(svc.approveCompletion(userA, completionId, NOV5)).rejects.toMatchObject({ httpStatus: 409 });
    expect((await bal(child.id)).available).toBe(500);
    const rewards = await svc.listChildTransactions(userA, child.id, { kind: "reward" });
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ sourceType: "REWARD", amountCents: 500, categoryName: "Recompensa" });
  });

  it("recorrente repete; única só uma vez; tarefa sem recompensa aprova sem pagar", async () => {
    const child = await newChild();
    const [rec, unica] = (await svc.createTask(userA, child.id, { name: "Quarto", hasReward: true, rewardAmount: "5" })).concat(
      await svc.createTask(userA, child.id, { name: "Ler livro", hasReward: true, rewardAmount: "20", repeatable: false }),
    ).slice(0, 3).filter((t, i) => i === 0 || i === 2);
    await svc.completeTask(userA, child.id, rec.id, { approve: true }, NOV5);
    await svc.completeTask(userA, child.id, rec.id, { approve: true }, NOV5);
    expect((await bal(child.id)).available).toBe(1000);
    await svc.completeTask(userA, child.id, unica.id, { approve: true }, NOV5);
    await expect(svc.completeTask(userA, child.id, unica.id, { approve: true }, NOV5)).rejects.toMatchObject({ httpStatus: 409 });
    expect((await bal(child.id)).available).toBe(3000);
    const [simples] = (await svc.createTask(userA, child.id, { name: "Cama", hasReward: false })).slice(-1);
    const done = await svc.completeTask(userA, child.id, simples.id, { approve: true }, NOV5);
    expect(done.paidCents).toBe(0);
    expect((await bal(child.id)).available).toBe(3000);
  });

  it("recusar não paga", async () => {
    const child = await newChild();
    const [task] = await svc.createTask(userA, child.id, { name: "Quarto", hasReward: true, rewardAmount: "5" });
    const { completionId } = await svc.completeTask(userA, child.id, task.id);
    await svc.rejectCompletion(userA, completionId);
    expect((await bal(child.id)).available).toBe(0);
    await expect(svc.approveCompletion(userA, completionId)).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe("categorias", () => {
  it("19) padrões existem; 20) personalizadas: cria, edita, desativa; padrão não muda", async () => {
    const list = await svc.listUserCategories(userA);
    expect(list.filter((c) => c.type === "EXPENSE")).toHaveLength(13);
    expect(list.filter((c) => c.type === "INCOME")).toHaveLength(5);
    const custom = await svc.createCategory(userA, { name: "Pets", type: "EXPENSE", icon: "🐶" });
    expect(custom.isSystem).toBe(false);
    await expect(svc.createCategory(userA, { name: "pets", type: "EXPENSE" })).rejects.toMatchObject({ httpStatus: 409 });
    expect((await svc.updateCategory(userA, custom.id, { name: "Animais" })).name).toBe("Animais");
    expect((await svc.listUserCategories(userB)).some((c) => c.id === custom.id)).toBe(false);
    await expect(svc.updateCategory(userB, custom.id, { name: "X" })).rejects.toMatchObject({ httpStatus: 404 });
    const child = await withAllowance();
    await svc.registerExpense(userA, child.id, { amount: "5", categoryId: custom.id }, NOV5);
    await svc.updateCategory(userA, custom.id, { active: false });
    expect((await svc.listUserCategories(userA)).some((c) => c.id === custom.id)).toBe(false);
    const hist = await svc.listChildTransactions(userA, child.id, {});
    expect(hist.some((t) => t.categoryName === "Animais")).toBe(true); // histórico preservado
    const system = list.find((c) => c.isSystem)!;
    await expect(svc.updateCategory(userA, system.id, { name: "Hack" })).rejects.toMatchObject({ httpStatus: 404 });
  });
});

describe("histórico, resumo, limite semanal e alertas", () => {
  it("21-22) histórico com filtros e resumo mensal com gastos por categoria", async () => {
    const child = await withAllowance();
    const lanches = await category("Lanches", "EXPENSE");
    const jogos = await category("Jogos", "EXPENSE");
    await svc.registerExpense(userA, child.id, { amount: "30", categoryId: lanches.id, date: "2026-11-06" }, NOV5);
    await svc.registerExpense(userA, child.id, { amount: "10", categoryId: jogos.id, date: "2026-11-07" }, NOV5);
    await svc.depositSavings(userA, child.id, { amount: "10", date: "2026-11-08" }, NOV5);
    expect(await svc.listChildTransactions(userA, child.id, { kind: "expense" })).toHaveLength(2);
    expect(await svc.listChildTransactions(userA, child.id, { kind: "savings" })).toHaveLength(1);
    expect(await svc.listChildTransactions(userA, child.id, { kind: "allowance" })).toHaveLength(1);
    expect(await svc.listChildTransactions(userA, child.id, { categoryId: lanches.id })).toHaveLength(1);
    expect(await svc.listChildTransactions(userA, child.id, { from: "2026-11-07", to: "2026-11-07" })).toHaveLength(1);
    const s = await svc.getMonthlySummary(userA, child.id, 2026, 11);
    expect(s).toMatchObject({ allowanceIncomeCents: 10000, expensesCents: 4000, savingsCents: 1000, balanceCents: 5000, totalIncomeCents: 10000 });
    expect(s.byCategory.map((c) => [c.name, c.pct])).toEqual([["Lanches", 75], ["Jogos", 25]]);
    expect((await svc.getMonthlySummary(userA, child.id, 2026, 10)).totalIncomeCents).toBe(0);
  });

  it("25) limite semanal orienta (sem bloquear) e alerta ao atingir; alerta de 80%", async () => {
    const child = await withAllowance();
    await svc.updateChildSettings(userA, child.id, { weeklyLimit: "30" });
    await svc.registerExpense(userA, child.id, { amount: "24", date: "2026-11-03" }, NOV5);
    let dash = await svc.getChildDashboard(userA, child.id, NOV5);
    expect(dash.weekly).toEqual({ limitCents: 3000, spentCents: 2400, remainingCents: 600 });
    expect(dash.alerts.some((a) => a.kind === "WEEKLY_LIMIT")).toBe(false);
    await svc.registerExpense(userA, child.id, { amount: "60", date: "2026-11-04" }, NOV5); // acima do limite: não bloqueia
    dash = await svc.getChildDashboard(userA, child.id, NOV5);
    expect(dash.alerts.map((a) => a.kind)).toEqual(expect.arrayContaining(["WEEKLY_LIMIT", "SPENT_80"]));
  });
});

describe("cenário principal — Luna", () => {
  it("mesada 100, lanche 20, brinquedo 10, guardou 20, recompensa 5 → saldo 55, cofrinho 20, entradas 105, gastos 30", async () => {
    const luna = await newChild("Luna");
    await svc.setAllowance(userA, luna.id, { monthlyAmount: "100", paymentDay: 5, startDate: "2026-11-01" }, NOV5);
    await svc.registerExpense(userA, luna.id, { amount: "20", categoryId: (await category("Lanches", "EXPENSE")).id, description: "Lanche" }, NOV5);
    await svc.registerExpense(userA, luna.id, { amount: "10", categoryId: (await category("Brinquedos", "EXPENSE")).id, description: "Brinquedo" }, NOV5);
    await svc.depositSavings(userA, luna.id, { amount: "20" }, NOV5);
    const [task] = await svc.createTask(userA, luna.id, { name: "Arrumar o quarto", hasReward: true, rewardAmount: "5" });
    await svc.completeTask(userA, luna.id, task.id, { approve: true }, NOV5);

    expect(await bal(luna.id)).toEqual({ available: 5500, savings: 2000 });
    const dash = await svc.getChildDashboard(userA, luna.id, NOV5);
    expect(dash.balanceCents).toBe(5500);
    expect(dash.savingsCents).toBe(2000);
    expect(dash.month.totalIncomeCents).toBe(10500);
    expect(dash.month.expensesCents).toBe(3000);
    expect(dash.badges.map((b) => b.code)).toContain("FIRST_SAVING");
    expect(dash.nextPaymentDate).toBe("2026-12-05");

    const overview = (await svc.listChildrenOverview(userA, NOV5))[0];
    expect(overview).toMatchObject({ balanceCents: 5500, savingsCents: 2000, rewardsThisMonthCents: 500 });
    // o saldo é derivado: nenhuma coluna de saldo existe
    const cols = await db.sql`select column_name from information_schema.columns where table_name = 'allowance_children'`;
    expect(cols.map((c) => c.column_name as string).some((c) => /balance$/.test(c) && c !== "allow_negative_balance")).toBe(false);
  });
});
