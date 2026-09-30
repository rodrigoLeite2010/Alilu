import type { FinEntry, Occurrence } from "@/lib/financas/types";
import type { EntryInput, GoalInput } from "@/lib/financas/validation";
import type { Goal } from "@/lib/financas/goals";

/** Evento global: qualquer tela recarrega seus dados quando algo é salvo. */
export const FINANCE_CHANGED_EVENT = "alilu:financas-changed";

export function notifyFinanceChanged(): void {
  window.dispatchEvent(new Event(FINANCE_CHANGED_EVENT));
}

export interface MonthData {
  month: string;
  today: string;
  occurrences: Occurrence[];
  savingsGoalCents: number;
  openingBalanceCents: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Algo deu errado. Tente novamente.");
  return data;
}

export interface YearData {
  year: string;
  today: string;
  occurrences: Occurrence[];
}

export const financeApi = {
  loadMonth: (month: string) => request<MonthData>(`/api/financas/month?month=${month}`),
  loadYear: (year: string) => request<YearData>(`/api/financas/year?year=${year}`),
  listEntries: (kind: "income" | "expense") =>
    request<{ entries: FinEntry[] }>(`/api/financas/entries?kind=${kind}`).then((r) => r.entries),
  createEntry: (input: EntryInput) =>
    request<{ id: string }>("/api/financas/entries", { method: "POST", body: JSON.stringify(input) }),
  updateEntry: (id: string, input: EntryInput) =>
    request<{ ok: true }>(`/api/financas/entries/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteEntry: (id: string) => request<{ ok: true }>(`/api/financas/entries/${id}`, { method: "DELETE" }),
  setPaid: (id: string, date: string, paid: boolean) =>
    request<{ ok: true }>(`/api/financas/entries/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ date, paid }),
    }),
  saveSettings: (settings: { savingsGoalCents?: number; month?: string; openingBalanceCents?: number }) =>
    request<{ ok: true }>("/api/financas/settings", { method: "PUT", body: JSON.stringify(settings) }),
  listGoals: () => request<{ goals: Goal[] }>("/api/financas/goals").then((r) => r.goals),
  createGoal: (input: GoalInput) => request<{ id: string }>("/api/financas/goals", { method: "POST", body: JSON.stringify(input) }),
  updateGoal: (id: string, input: GoalInput) =>
    request<{ ok: true }>(`/api/financas/goals/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteGoal: (id: string) => request<{ ok: true }>(`/api/financas/goals/${id}`, { method: "DELETE" }),
  depositToGoal: (id: string, deltaCents: number) =>
    request<{ ok: true }>(`/api/financas/goals/${id}/deposit`, { method: "POST", body: JSON.stringify({ deltaCents }) }),
};
