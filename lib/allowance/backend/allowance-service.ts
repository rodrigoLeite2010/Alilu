import "server-only";
import { isValidIsoDate, monthRange, nextPaymentDate, todayInTimezone, weekRange } from "../dates";
import { formatCents, parseMoneyToCents, parseMoneyToCentsAllowZero } from "../money";
import type {
  Alert,
  Badge,
  CategoryDto,
  CategoryType,
  ChildDto,
  ChildOverview,
  GoalDto,
  MonthlySummary,
  PlanDto,
  TaskDto,
  TransactionDto,
} from "../types";
import * as repo from "./allowance-repository";
import { catchUpChild } from "./schedule-service";

/**
 * Regras da Mesada. O usuário vem SEMPRE da sessão. Valores monetários são centavos inteiros;
 * o saldo é sempre calculado pelas movimentações (nunca guardado nem calculado na tela).
 */

export class AllowanceError extends Error {
  constructor(message: string, readonly httpStatus = 400, readonly code = "BAD_REQUEST") {
    super(message);
    this.name = "AllowanceError";
  }
}

type Body = Record<string, unknown>;
const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

// ---------------------------------------------------------------------------
// Mapeamentos
// ---------------------------------------------------------------------------
const toChildDto = (c: repo.ChildRecord): ChildDto => ({
  id: c.id,
  name: c.name,
  avatar: c.avatar,
  birthDate: c.birthDate,
  allowNegativeBalance: c.allowNegativeBalance,
  weeklyLimitCents: c.weeklyLimitCents,
  active: c.active,
});
const toPlanDto = (p: repo.PlanRecord): PlanDto => ({
  id: p.id,
  name: p.name,
  monthlyAmountCents: p.monthlyAmountCents,
  paymentDay: p.paymentDay,
  carryOverBalance: p.carryOverBalance,
  active: p.active,
  startDate: p.startDate,
});
const toCategoryDto = (c: repo.CategoryRecord): CategoryDto => ({
  id: c.id,
  name: c.name,
  type: c.type,
  icon: c.icon,
  color: c.color,
  isSystem: c.isSystem,
  active: c.active,
  sortOrder: c.sortOrder,
});
const toTransactionDto = (t: repo.TransactionRecord): TransactionDto => ({
  id: t.id,
  childId: t.childId,
  type: t.type,
  sourceType: t.sourceType,
  categoryId: t.categoryId,
  categoryName: t.categoryName,
  categoryIcon: t.categoryIcon,
  goalId: t.goalId,
  goalName: t.goalName,
  amountCents: t.amountCents,
  description: t.description,
  date: t.date,
});
const toGoalDto = (g: repo.GoalRecord): GoalDto => ({
  id: g.id,
  name: g.name,
  targetCents: g.targetCents,
  savedCents: Math.max(0, g.savedCents),
  progressPct: Math.min(100, Math.round((Math.max(0, g.savedCents) / g.targetCents) * 100)),
  targetDate: g.targetDate,
  icon: g.icon,
  status: g.status === "ACTIVE" && g.savedCents >= g.targetCents ? "ACHIEVED" : g.status,
});
const toTaskDto = (t: repo.TaskRecord): TaskDto => ({
  id: t.id,
  name: t.name,
  description: t.description,
  hasReward: t.hasReward,
  rewardCents: t.rewardCents,
  repeatable: t.repeatable,
  active: t.active,
  pendingCompletionId: t.pendingCompletionId,
  completedCount: t.completedCount,
  done: !t.repeatable && t.completedCount > 0,
});

/** Criança do usuário ou 404 (nunca revela se existe para outro usuário). */
async function requireChild(userId: string, childId: unknown): Promise<repo.ChildRecord> {
  if (typeof childId !== "string" || !/^[0-9a-f-]{36}$/i.test(childId)) throw new AllowanceError("Criança não encontrada.", 404, "NOT_FOUND");
  const child = await repo.getChildForUser(userId, childId);
  if (!child) throw new AllowanceError("Criança não encontrada.", 404, "NOT_FOUND");
  return child;
}

function requireDate(value: unknown, now: Date): string {
  if (value === undefined || value === null || value === "") return todayInTimezone(now);
  if (!isValidIsoDate(value)) throw new AllowanceError("Data inválida.");
  return value;
}

function requireAmount(value: unknown, label = "O valor"): number {
  const cents = parseMoneyToCents(value);
  if (cents === null) throw new AllowanceError(`${label} precisa ser maior que zero.`);
  return cents;
}

function cleanAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v) && v.length <= 500) return v;
  return [...v].length <= 4 ? v : null; // emoji
}

// ---------------------------------------------------------------------------
// Crianças
// ---------------------------------------------------------------------------
export async function createChild(userId: string, body: Body): Promise<ChildDto> {
  const name = text(body.name, 60);
  if (!name) throw new AllowanceError("Informe o nome da criança.");
  const birthDate = body.birthDate ? (isValidIsoDate(body.birthDate) ? (body.birthDate as string) : null) : null;
  if (body.birthDate && !birthDate) throw new AllowanceError("Data de nascimento inválida.");
  const child = await repo.insertChild(userId, { name, avatar: cleanAvatar(body.avatar), birthDate });
  return toChildDto(child);
}

export async function updateChildSettings(userId: string, childId: string, body: Body): Promise<ChildDto> {
  await requireChild(userId, childId);
  const patch: Parameters<typeof repo.updateChild>[2] = {};
  if (body.name !== undefined) {
    const name = text(body.name, 60);
    if (!name) throw new AllowanceError("Informe o nome da criança.");
    patch.name = name;
  }
  if (body.avatar !== undefined) patch.avatar = cleanAvatar(body.avatar);
  if (body.allowNegativeBalance !== undefined) patch.allowNegativeBalance = body.allowNegativeBalance === true;
  if (body.active !== undefined) patch.active = body.active === true;
  if (body.weeklyLimit !== undefined) {
    patch.weeklyLimitCents = body.weeklyLimit === null || body.weeklyLimit === "" || body.weeklyLimit === 0 ? null : requireAmount(body.weeklyLimit, "O limite semanal");
  }
  const updated = await repo.updateChild(userId, childId, patch);
  if (!updated) throw new AllowanceError("Criança não encontrada.", 404, "NOT_FOUND");
  return toChildDto(updated);
}

export async function listChildrenOverview(userId: string, now: Date = new Date()): Promise<ChildOverview[]> {
  const children = await repo.listChildren(userId);
  const ids = children.map((c) => c.id);
  const today = todayInTimezone(now);
  // Recupera mesadas que o cron ainda não lançou (idempotente) — o saldo mostrado já está em dia.
  const plans = await repo.getActivePlansForChildren(ids);
  for (const plan of plans.values()) await catchUpChild(plan, now);
  const [balances, goals, rewards] = await Promise.all([
    repo.getBalancesForChildren(ids),
    repo.countActiveGoals(ids),
    repo.sumRewardsInRange(ids, ...(Object.values(monthRange(...currentYearMonth(today))) as [string, string])),
  ]);
  return children.map((child) => {
    const plan = plans.get(child.id);
    const b = balances.get(child.id) ?? { availableCents: 0, savingsCents: 0 };
    return {
      child: toChildDto(child),
      balanceCents: b.availableCents,
      savingsCents: b.savingsCents,
      nextPaymentDate: plan ? nextPaymentDate(today, plan.paymentDay) : null,
      monthlyAmountCents: plan ? plan.monthlyAmountCents : null,
      activeGoals: goals.get(child.id) ?? 0,
      rewardsThisMonthCents: rewards.get(child.id) ?? 0,
    };
  });
}

function currentYearMonth(today: string): [number, number] {
  const [y, m] = today.split("-").map(Number);
  return [y, m];
}

// ---------------------------------------------------------------------------
// Mesada
// ---------------------------------------------------------------------------
export async function setAllowance(userId: string, childId: string, body: Body, now: Date = new Date()): Promise<PlanDto | null> {
  await requireChild(userId, childId);
  if (body.active === false) {
    await repo.deactivatePlan(childId);
    return null;
  }
  const amount = parseMoneyToCentsAllowZero(body.monthlyAmount);
  if (amount === null) throw new AllowanceError("O valor da mesada não pode ser negativo.");
  const paymentDay = Number(body.paymentDay);
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) throw new AllowanceError("Escolha o dia do pagamento (1 a 31).");
  const name = text(body.name, 60) || "Mesada mensal";
  const startDate = body.startDate ? (isValidIsoDate(body.startDate) ? (body.startDate as string) : null) : todayInTimezone(now);
  if (!startDate) throw new AllowanceError("Data inicial inválida.");
  const plan = await repo.savePlan(childId, {
    name,
    monthlyAmountCents: amount,
    paymentDay,
    carryOverBalance: body.carryOverBalance !== false,
    startDate,
  });
  await catchUpChild(plan, now);
  return toPlanDto(plan);
}

// ---------------------------------------------------------------------------
// Movimentações
// ---------------------------------------------------------------------------
async function requireCategory(userId: string, categoryId: unknown, type: CategoryType): Promise<string | null> {
  if (categoryId === undefined || categoryId === null || categoryId === "") return null;
  if (typeof categoryId !== "string") throw new AllowanceError("Categoria inválida.");
  const category = await repo.getCategoryForUser(userId, categoryId);
  if (!category || !category.active || category.type !== type) throw new AllowanceError("Categoria inválida.");
  return category.id;
}

async function requireGoal(childId: string, goalId: unknown): Promise<string | null> {
  if (goalId === undefined || goalId === null || goalId === "") return null;
  if (typeof goalId !== "string") throw new AllowanceError("Meta inválida.");
  const goal = await repo.getGoal(childId, goalId);
  if (!goal || goal.status === "CANCELED") throw new AllowanceError("Meta inválida.");
  return goal.id;
}

export async function registerExpense(userId: string, childId: string, body: Body, now: Date = new Date()): Promise<{ id: string; balanceCents: number }> {
  await requireChild(userId, childId);
  const amountCents = requireAmount(body.amount, "O gasto");
  const date = requireDate(body.date, now);
  const categoryId = await requireCategory(userId, body.categoryId, "EXPENSE");
  const id = await repo.insertExpense(userId, { childId, categoryId, amountCents, description: text(body.description, 120), date });
  if (!id) throw new AllowanceError("Saldo insuficiente para este gasto.", 409, "INSUFFICIENT_BALANCE");
  return { id, balanceCents: (await repo.getBalances(childId)).availableCents };
}

export async function registerIncome(userId: string, childId: string, body: Body, now: Date = new Date()): Promise<{ id: string; balanceCents: number }> {
  await requireChild(userId, childId);
  const amountCents = requireAmount(body.amount, "A entrada");
  const date = requireDate(body.date, now);
  const categoryId = await requireCategory(userId, body.categoryId, "INCOME");
  const id = await repo.insertIncome(userId, { childId, categoryId, amountCents, description: text(body.description, 120), date });
  if (!id) throw new AllowanceError("Criança não encontrada.", 404, "NOT_FOUND");
  return { id, balanceCents: (await repo.getBalances(childId)).availableCents };
}

export async function depositSavings(userId: string, childId: string, body: Body, now: Date = new Date()) {
  await requireChild(userId, childId);
  const amountCents = requireAmount(body.amount, "O valor a guardar");
  const goalId = await requireGoal(childId, body.goalId);
  const id = await repo.insertSavingsDeposit(userId, {
    childId,
    goalId,
    amountCents,
    description: text(body.description, 120) || "Guardou no cofrinho",
    date: requireDate(body.date, now),
  });
  if (!id) throw new AllowanceError("Você não tem saldo suficiente para guardar esse valor.", 409, "INSUFFICIENT_BALANCE");
  return { id, ...(await repo.getBalances(childId)) };
}

export async function withdrawSavings(userId: string, childId: string, body: Body, now: Date = new Date()) {
  await requireChild(userId, childId);
  const amountCents = requireAmount(body.amount, "O valor a retirar");
  const goalId = await requireGoal(childId, body.goalId);
  const id = await repo.insertSavingsWithdrawal(userId, {
    childId,
    goalId,
    amountCents,
    description: text(body.description, 120) || "Retirou do cofrinho",
    date: requireDate(body.date, now),
  });
  if (!id) throw new AllowanceError("Não há esse valor guardado no cofrinho.", 409, "INSUFFICIENT_SAVINGS");
  return { id, ...(await repo.getBalances(childId)) };
}

export async function listChildTransactions(userId: string, childId: string, query: Record<string, string | null>): Promise<TransactionDto[]> {
  await requireChild(userId, childId);
  const from = query.from && isValidIsoDate(query.from) ? query.from : undefined;
  const to = query.to && isValidIsoDate(query.to) ? query.to : undefined;
  const rows = await repo.listTransactions(childId, {
    from,
    to,
    kind: query.kind ?? undefined,
    categoryId: query.categoryId && /^[0-9a-f-]{36}$/i.test(query.categoryId) ? query.categoryId : undefined,
    limit: Number(query.limit) || 50,
    offset: Number(query.offset) || 0,
  });
  return rows.map(toTransactionDto);
}

export async function getMonthlySummary(userId: string, childId: string, year: number, month: number): Promise<MonthlySummary> {
  await requireChild(userId, childId);
  return buildMonthlySummary(childId, year, month);
}

async function buildMonthlySummary(childId: string, year: number, month: number): Promise<MonthlySummary> {
  const { from, to } = monthRange(year, month);
  const [totals, categories] = await Promise.all([repo.getMonthTotals(childId, from, to), repo.getSpendingByCategory(childId, from, to)]);
  const spent = categories.reduce((sum, c) => sum + c.totalCents, 0);
  return {
    year,
    month,
    allowanceIncomeCents: totals.allowanceIncomeCents,
    rewardIncomeCents: totals.rewardIncomeCents,
    extraIncomeCents: totals.extraIncomeCents,
    totalIncomeCents: totals.allowanceIncomeCents + totals.rewardIncomeCents + totals.extraIncomeCents,
    expensesCents: totals.expensesCents,
    savingsCents: totals.savingsCents,
    withdrawalsCents: totals.withdrawalsCents,
    adjustmentCents: totals.adjustmentCents,
    balanceCents: totals.balanceCents,
    byCategory: categories.map((c) => ({ ...c, pct: spent > 0 ? Math.round((c.totalCents / spent) * 100) : 0 })),
  };
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export async function listUserCategories(userId: string, includeInactive = false): Promise<CategoryDto[]> {
  return (await repo.listCategories(userId, includeInactive)).map(toCategoryDto);
}

export async function createCategory(userId: string, body: Body): Promise<CategoryDto> {
  const name = text(body.name, 40);
  if (!name) throw new AllowanceError("Informe o nome da categoria.");
  const type = body.type === "INCOME" ? "INCOME" : "EXPENSE";
  const existing = (await repo.listCategories(userId, true)).filter((c) => c.type === type);
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.active)) throw new AllowanceError("Já existe uma categoria com esse nome.", 409);
  const icon = text(body.icon, 8) || "🏷️";
  const color = typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : null;
  const sortOrder = Math.max(0, ...existing.map((c) => c.sortOrder)) + 1;
  return toCategoryDto(await repo.insertCategory(userId, { name, type, icon, color, sortOrder: Math.min(sortOrder, 98) }));
}

export async function updateCategory(userId: string, id: string, body: Body): Promise<CategoryDto> {
  const patch: Parameters<typeof repo.updateOwnCategory>[2] = {};
  if (body.name !== undefined) {
    const name = text(body.name, 40);
    if (!name) throw new AllowanceError("Informe o nome da categoria.");
    patch.name = name;
  }
  if (body.icon !== undefined) patch.icon = text(body.icon, 8) || "🏷️";
  if (body.active !== undefined) patch.active = body.active === true; // nunca exclui: só desativa (histórico preservado)
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) patch.sortOrder = Math.max(0, Math.min(98, Math.round(Number(body.sortOrder))));
  const updated = await repo.updateOwnCategory(userId, id, patch);
  if (!updated) throw new AllowanceError("Categoria não encontrada ou não editável (as padrão não podem ser alteradas).", 404, "NOT_FOUND");
  return toCategoryDto(updated);
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------
export async function createGoal(userId: string, childId: string, body: Body): Promise<GoalDto> {
  await requireChild(userId, childId);
  const name = text(body.name, 60);
  if (!name) throw new AllowanceError("Dê um nome para a meta.");
  const targetCents = requireAmount(body.targetAmount, "O valor da meta");
  const targetDate = body.targetDate ? (isValidIsoDate(body.targetDate) ? (body.targetDate as string) : null) : null;
  if (body.targetDate && !targetDate) throw new AllowanceError("Data da meta inválida.");
  return toGoalDto(await repo.insertGoal(childId, { name, targetCents, targetDate, icon: text(body.icon, 8) || "🎯" }));
}

export async function updateGoalStatus(userId: string, childId: string, goalId: string, body: Body): Promise<GoalDto> {
  await requireChild(userId, childId);
  const patch: Parameters<typeof repo.updateGoal>[2] = {};
  if (body.name !== undefined) patch.name = text(body.name, 60) || undefined;
  if (body.targetAmount !== undefined) patch.targetCents = requireAmount(body.targetAmount, "O valor da meta");
  if (body.status === "CANCELED" || body.status === "ACTIVE" || body.status === "ACHIEVED") patch.status = body.status;
  const goal = await repo.updateGoal(childId, goalId, patch);
  if (!goal) throw new AllowanceError("Meta não encontrada.", 404, "NOT_FOUND");
  return toGoalDto(goal);
}

// ---------------------------------------------------------------------------
// Tarefas e recompensas
// ---------------------------------------------------------------------------
export async function createTask(userId: string, childId: string, body: Body): Promise<TaskDto[]> {
  await requireChild(userId, childId);
  const name = text(body.name, 80);
  if (!name) throw new AllowanceError("Dê um nome para a tarefa.");
  const hasReward = body.hasReward === true;
  let rewardCents = 0;
  if (hasReward) {
    const parsed = parseMoneyToCents(body.rewardAmount);
    if (parsed === null) throw new AllowanceError("A recompensa precisa ser maior que zero (ou desmarque “com recompensa”).");
    rewardCents = parsed;
  }
  await repo.insertTask(childId, { name, description: text(body.description, 300) || null, hasReward, rewardCents, repeatable: body.repeatable !== false });
  return listTasksFor(userId, childId);
}

export async function updateTaskSettings(userId: string, childId: string, taskId: string, body: Body): Promise<TaskDto[]> {
  await requireChild(userId, childId);
  const patch: Parameters<typeof repo.updateTask>[2] = {};
  if (body.name !== undefined) patch.name = text(body.name, 80) || undefined;
  if (body.active !== undefined) patch.active = body.active === true;
  if (body.repeatable !== undefined) patch.repeatable = body.repeatable === true;
  if (body.hasReward !== undefined) patch.hasReward = body.hasReward === true;
  if (body.rewardAmount !== undefined) {
    const parsed = parseMoneyToCents(body.rewardAmount);
    if (parsed === null) throw new AllowanceError("A recompensa precisa ser maior que zero.");
    patch.rewardCents = parsed;
  }
  if (patch.hasReward === true && patch.rewardCents === undefined) {
    const current = await repo.getTask(childId, taskId);
    if (!current || current.rewardCents <= 0) throw new AllowanceError("Informe o valor da recompensa.");
  }
  if (!(await repo.updateTask(childId, taskId, patch))) throw new AllowanceError("Tarefa não encontrada.", 404, "NOT_FOUND");
  return listTasksFor(userId, childId);
}

export async function listTasksFor(userId: string, childId: string): Promise<TaskDto[]> {
  await requireChild(userId, childId);
  return (await repo.listTasks(childId)).map(toTaskDto);
}

/**
 * Marca a tarefa como concluída. NÃO gera dinheiro: fica aguardando a aprovação do responsável.
 * `approve: true` aprova na mesma ação (o responsável é quem está clicando).
 */
export async function completeTask(
  userId: string,
  childId: string,
  taskId: string,
  options: { approve?: boolean } = {},
  now: Date = new Date(),
): Promise<{ completionId: string; paidCents: number }> {
  await requireChild(userId, childId);
  const task = await repo.getTask(childId, taskId);
  if (!task || !task.active) throw new AllowanceError("Tarefa não encontrada.", 404, "NOT_FOUND");
  let completionId = task.pendingCompletionId;
  if (!completionId) {
    completionId = await repo.insertCompletion(childId, taskId);
    if (!completionId) throw new AllowanceError("Esta tarefa já foi concluída.", 409, "ALREADY_COMPLETED");
  }
  if (!options.approve) return { completionId, paidCents: 0 };
  const result = await repo.approveCompletion(userId, completionId, todayInTimezone(now));
  return { completionId, paidCents: result.paidCents };
}

export async function approveCompletion(userId: string, completionId: string, now: Date = new Date()): Promise<{ paidCents: number }> {
  const owner = await repo.getCompletionOwner(completionId);
  if (!owner || owner.userId !== userId) throw new AllowanceError("Conclusão não encontrada.", 404, "NOT_FOUND");
  const result = await repo.approveCompletion(userId, completionId, todayInTimezone(now));
  if (!result.approved) throw new AllowanceError("Esta conclusão já foi analisada.", 409, "ALREADY_REVIEWED");
  return { paidCents: result.paidCents };
}

export async function rejectCompletion(userId: string, completionId: string): Promise<void> {
  const owner = await repo.getCompletionOwner(completionId);
  if (!owner || owner.userId !== userId) throw new AllowanceError("Conclusão não encontrada.", 404, "NOT_FOUND");
  if (!(await repo.rejectCompletion(userId, completionId))) throw new AllowanceError("Esta conclusão já foi analisada.", 409, "ALREADY_REVIEWED");
}

// ---------------------------------------------------------------------------
// Tela da criança (dashboard) — tudo calculado aqui, não na tela
// ---------------------------------------------------------------------------
export interface ChildDashboard {
  child: ChildDto;
  plan: PlanDto | null;
  balanceCents: number;
  savingsCents: number;
  nextPaymentDate: string | null;
  month: MonthlySummary;
  weekly: { limitCents: number; spentCents: number; remainingCents: number } | null;
  alerts: Alert[];
  badges: Badge[];
  goals: GoalDto[];
  tasks: TaskDto[];
  recent: TransactionDto[];
  expenseCategories: CategoryDto[];
  incomeCategories: CategoryDto[];
}

export async function getChildDashboard(userId: string, childId: string, now: Date = new Date()): Promise<ChildDashboard> {
  const child = await requireChild(userId, childId);
  const today = todayInTimezone(now);
  const [year, month] = currentYearMonth(today);
  const plan = await repo.getActivePlan(childId);
  if (plan) await catchUpChild(plan, now);

  const week = weekRange(today);
  const monthStart = monthRange(year, month).from;
  const [balances, summary, goals, tasks, recent, categories, weekSpent, badgeFacts] = await Promise.all([
    repo.getBalances(childId),
    buildMonthlySummary(childId, year, month),
    repo.listGoals(childId),
    repo.listTasks(childId),
    repo.listTransactions(childId, { limit: 8 }),
    repo.listCategories(userId),
    child.weeklyLimitCents ? repo.sumExpenses(childId, week.from, week.to) : Promise.resolve(0),
    repo.getBadgeFacts(childId, monthStart),
  ]);

  const goalDtos = goals.map(toGoalDto);
  const weekly = child.weeklyLimitCents
    ? { limitCents: child.weeklyLimitCents, spentCents: weekSpent, remainingCents: Math.max(0, child.weeklyLimitCents - weekSpent) }
    : null;

  const alerts: Alert[] = [];
  const monthlyAmount = plan?.monthlyAmountCents ?? 0;
  if (monthlyAmount > 0 && summary.expensesCents >= monthlyAmount * 0.8) {
    alerts.push({ kind: "SPENT_80", message: "Você já gastou 80% da mesada." });
  }
  if (weekly && weekly.spentCents >= weekly.limitCents) alerts.push({ kind: "WEEKLY_LIMIT", message: "Você atingiu seu limite semanal." });
  for (const goal of goalDtos.filter((g) => g.status === "ACTIVE")) {
    alerts.push({ kind: "GOAL_REMAINING", message: `Faltam ${formatCents(goal.targetCents - goal.savedCents)} para sua meta “${goal.name}”.` });
  }
  if (monthlyAmount > 0 && summary.savingsCents >= monthlyAmount * 0.25) {
    alerts.push({ kind: "SAVED_25", message: "Você guardou 25% da mesada este mês." });
  }

  const badges: Badge[] = [];
  if (badgeFacts.savingDeposits > 0) badges.push({ code: "FIRST_SAVING", label: "Primeira economia" });
  if (badgeFacts.savingMonths >= 3) badges.push({ code: "SAVED_3_MONTHS", label: "Guardou dinheiro 3 meses" });
  if (goalDtos.some((g) => g.status === "ACHIEVED")) badges.push({ code: "GOAL_ACHIEVED", label: "Atingiu uma meta" });
  if (badgeFacts.monthsNotAllSpent > 0) badges.push({ code: "MONTH_NOT_ALL_SPENT", label: "Passou um mês sem gastar tudo" });

  return {
    child: toChildDto(child),
    plan: plan ? toPlanDto(plan) : null,
    balanceCents: balances.availableCents,
    savingsCents: balances.savingsCents,
    nextPaymentDate: plan ? nextPaymentDate(today, plan.paymentDay) : null,
    month: summary,
    weekly,
    alerts,
    badges,
    goals: goalDtos,
    tasks: tasks.map(toTaskDto),
    recent: recent.map(toTransactionDto),
    expenseCategories: categories.filter((c) => c.type === "EXPENSE").map(toCategoryDto),
    incomeCategories: categories.filter((c) => c.type === "INCOME").map(toCategoryDto),
  };
}

export async function getAvailableBalance(childId: string): Promise<number> {
  return (await repo.getBalances(childId)).availableCents;
}
export async function getSavingsBalance(childId: string): Promise<number> {
  return (await repo.getBalances(childId)).savingsCents;
}
