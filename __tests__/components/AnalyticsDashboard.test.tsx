import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("mostra os totais de cada período separadamente e mantém os acessos online", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify({
    configured: true,
    data: url.endsWith("/summary") ? {
      onlineNow: 7, onlineWindowMinutes: 5,
      visitorsToday: 12, sessionsToday: 18, pageViewsToday: 31,
      visitorsThisMonth: 120, sessionsThisMonth: 180, pageViewsThisMonth: 310,
      visitorsThisYear: 1200, sessionsThisYear: 1800, pageViewsThisYear: 3100,
    } : [],
  }), { status: 200 })));
  render(<AnalyticsDashboard />);
  await screen.findByText("3.100");
  for (const [period, values] of [
    ["Hoje", ["12", "18", "31"]],
    ["Este mês", ["120", "180", "310"]],
    ["Este ano", ["1.200", "1.800", "3.100"]],
  ] as const) {
    const section = within(screen.getByRole("region", { name: `Acessos — ${period}` }));
    for (const value of values) expect(section.getByText(value)).toBeInTheDocument();
  }
  expect(screen.getByText("7")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Páginas mais acessadas hoje" })).toBeInTheDocument();
});
