export type TransactionType = "INCOME" | "EXPENSE" | "SAVINGS_TRANSFER" | "SAVINGS_WITHDRAWAL";
export type SourceType = "MANUAL" | "ALLOWANCE" | "REWARD" | "ADJUSTMENT" | "SAVINGS";
export type CategoryType = "EXPENSE" | "INCOME";

export interface ChildDto {
  id: string;
  name: string;
  avatar: string | null;
  birthDate: string | null;
  allowNegativeBalance: boolean;
  weeklyLimitCents: number | null;
  active: boolean;
}

export interface PlanDto {
  id: string;
  name: string;
  monthlyAmountCents: number;
  paymentDay: number;
  carryOverBalance: boolean;
  active: boolean;
  startDate: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string | null;
  isSystem: boolean;
  active: boolean;
  sortOrder: number;
}

export interface TransactionDto {
  id: string;
  childId: string;
  type: TransactionType;
  sourceType: SourceType;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  goalId: string | null;
  goalName: string | null;
  amountCents: number;
  description: string;
  date: string;
}

export interface GoalDto {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  progressPct: number;
  targetDate: string | null;
  icon: string;
  status: "ACTIVE" | "ACHIEVED" | "CANCELED";
}

export interface TaskDto {
  id: string;
  name: string;
  description: string | null;
  hasReward: boolean;
  rewardCents: number;
  repeatable: boolean;
  active: boolean;
  /** Conclusão aguardando aprovação do responsável. */
  pendingCompletionId: string | null;
  completedCount: number;
  /** Tarefa única já aprovada. */
  done: boolean;
}

export interface MonthlySummary {
  year: number;
  month: number;
  allowanceIncomeCents: number;
  rewardIncomeCents: number;
  extraIncomeCents: number;
  totalIncomeCents: number;
  expensesCents: number;
  savingsCents: number;
  withdrawalsCents: number;
  adjustmentCents: number;
  /** Saldo disponível no fim do mês. */
  balanceCents: number;
  byCategory: Array<{ categoryId: string | null; name: string; icon: string; totalCents: number; pct: number }>;
}

export interface ChildOverview {
  child: ChildDto;
  balanceCents: number;
  savingsCents: number;
  nextPaymentDate: string | null;
  monthlyAmountCents: number | null;
  activeGoals: number;
  rewardsThisMonthCents: number;
}

export interface Alert {
  kind: "SPENT_80" | "WEEKLY_LIMIT" | "GOAL_REMAINING" | "SAVED_25";
  message: string;
}

export interface Badge {
  code: "FIRST_SAVING" | "SAVED_3_MONTHS" | "GOAL_ACHIEVED" | "MONTH_NOT_ALL_SPENT";
  label: string;
}
