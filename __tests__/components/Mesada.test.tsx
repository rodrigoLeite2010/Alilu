import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildDashboard } from "@/lib/allowance/backend/allowance-service";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("server-only", () => ({}));

const { ChildPanel } = await import("@/components/mesada/ChildPanel");
const { MesadaHome } = await import("@/components/mesada/MesadaHome");

const dashboard: ChildDashboard = {
  child: { id: "c1", name: "Luna", avatar: "🦄", birthDate: null, allowNegativeBalance: false, weeklyLimitCents: null, active: true },
  plan: { id: "p1", name: "Mesada mensal", monthlyAmountCents: 10000, paymentDay: 5, carryOverBalance: true, active: true, startDate: "2026-11-01" },
  balanceCents: 5500,
  savingsCents: 2000,
  nextPaymentDate: "2026-12-05",
  month: { year: 2026, month: 11, allowanceIncomeCents: 10000, rewardIncomeCents: 500, extraIncomeCents: 0, totalIncomeCents: 10500, expensesCents: 3000, savingsCents: 2000, withdrawalsCents: 0, adjustmentCents: 0, balanceCents: 5500, byCategory: [{ categoryId: "k", name: "Lanches", icon: "🍔", totalCents: 2000, pct: 67 }] },
  weekly: null,
  alerts: [{ kind: "SAVED_25", message: "Você guardou 25% da mesada este mês." }],
  badges: [{ code: "FIRST_SAVING", label: "Primeira economia" }],
  goals: [{ id: "g1", name: "Bicicleta", targetCents: 80000, savedCents: 24000, progressPct: 30, targetDate: null, icon: "🚲", status: "ACTIVE" }],
  tasks: [{ id: "t1", name: "Arrumar o quarto", description: null, hasReward: true, rewardCents: 500, repeatable: true, active: true, pendingCompletionId: null, completedCount: 0, done: false }],
  recent: [],
  expenseCategories: [{ id: "k", name: "Lanches", type: "EXPENSE", icon: "🍔", color: null, isSystem: true, active: true, sortOrder: 1 }],
  incomeCategories: [],
};

beforeEach(() => {
  refresh.mockReset();
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }) as Response) as unknown as typeof fetch;
});

describe("Mesada (telas)", () => {
  it("mostra saldo, cofrinho, mesada e alertas da criança", () => {
    render(<ChildPanel dashboard={dashboard} />);
    expect(screen.getByRole("heading", { name: "Luna" })).toBeInTheDocument();
    expect(screen.getByText("Saldo disponível").nextElementSibling).toHaveTextContent(/R\$\s*55,00/);
    expect(screen.getByText(/Cofrinho/).nextElementSibling).toHaveTextContent(/R\$\s*20,00/);
    expect(screen.getByText(/100,00 \/ mês/)).toBeInTheDocument();
    expect(screen.getByText(/guardou 25%/)).toBeInTheDocument();
    expect(screen.getByText(/Primeira economia/)).toBeInTheDocument();
  });

  it("registrar gasto envia ao servidor e mostra o erro de saldo sem fechar", async () => {
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: "Saldo insuficiente para este gasto." }) }) as Response) as unknown as typeof fetch;
    render(<ChildPanel dashboard={dashboard} />);
    fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
    fireEvent.change(screen.getByLabelText(/Valor/), { target: { value: "999" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Registrar gasto/ }).at(-1)!);
    expect(await screen.findByText("Saldo insuficiente para este gasto.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/allowance/children/c1/expenses");
  });

  it("aba Tarefas: concluir pede aprovação do responsável via API", async () => {
    render(<ChildPanel dashboard={dashboard} />);
    fireEvent.click(screen.getByRole("button", { name: "Tarefas" }));
    fireEvent.click(screen.getByRole("button", { name: /Marcar como concluída/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/allowance/children/c1/tasks/t1/complete");
  });

  it("home: cartões das crianças e estado vazio", () => {
    const { rerender } = render(<MesadaHome overview={[]} />);
    expect(screen.getByText(/Cadastre a primeira criança/)).toBeInTheDocument();
    rerender(
      <MesadaHome
        overview={[
          { child: dashboard.child, balanceCents: 6350, savingsCents: 12000, nextPaymentDate: "2026-12-05", monthlyAmountCents: 10000, activeGoals: 1, rewardsThisMonthCents: 1500 },
          { child: { ...dashboard.child, id: "c2", name: "Pedro", avatar: null }, balanceCents: 4200, savingsCents: 8000, nextPaymentDate: null, monthlyAmountCents: null, activeGoals: 2, rewardsThisMonthCents: 1000 },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Luna/ })).toHaveAttribute("href", "/mesada/c1");
    expect(screen.getByRole("link", { name: /Pedro/ })).toBeInTheDocument();
    expect(screen.getByText("Saldo da família")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar criança/ })).toBeInTheDocument();
  });
});
