import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PublicationsManager, publicationDayKey } from "@/components/instagram/PublicationsManager";
import type { CalendarPostCardData } from "@/components/instagram/CalendarPostCard";

function post(id: string, status: CalendarPostCardData["status"], extra: Partial<CalendarPostCardData> = {}): CalendarPostCardData {
  return {
    id,
    postType: "image",
    status,
    caption: `Legenda ${id}`,
    scheduledAtUtc: null,
    publishedAt: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    lastErrorSanitized: null,
    igUsername: "alilu.tec",
    mediaStorageUrl: null,
    itemCount: 1,
    timezone: "America/Sao_Paulo",
    ...extra,
  };
}

const posts = [
  post("a", "DRAFT"),
  post("b", "SCHEDULED", { scheduledAtUtc: "2026-09-24T21:30:00.000Z" }),
  post("c", "PUBLISHED", { publishedAt: "2026-09-23T12:00:00.000Z" }),
  post("d", "FAILED"),
  post("e", "CANCELLED"),
];

describe("PublicationsManager", () => {
  it("filtra por status com contadores", () => {
    render(<PublicationsManager initialPosts={posts} userId="u1" />);
    expect(screen.getByRole("tab", { name: /Todas 5/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /Agendadas 1/ }));
    expect(screen.getByText("Legenda b")).toBeInTheDocument();
    expect(screen.queryByText("Legenda a")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Falharam 1/ }));
    expect(screen.getByText("Legenda d")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Canceladas 1/ }));
    expect(screen.getByText("Legenda e")).toBeInTheDocument();
  });

  it("dia do calendário usa o fuso do agendamento (21:30Z = 18:30 em SP, mesmo dia)", () => {
    expect(publicationDayKey(post("x", "SCHEDULED", { scheduledAtUtc: "2026-09-25T01:30:00.000Z" }))).toBe("2026-09-24");
  });

  it("calendário mostra o mês e, ao tocar no dia, lista as publicações dele", () => {
    render(<PublicationsManager initialPosts={posts} userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: "Calendário" }));
    const calendar = screen.getByRole("region", { name: "Calendário de publicações" });
    // Navega do mês atual até setembro/2026, qualquer que seja a data de hoje.
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const [rawMonth, , year] = (within(calendar).getByText(/ de \d{4}$/).textContent ?? "").split(" ");
    const monthName = rawMonth.toLowerCase();
    const delta = 2026 * 12 + 8 - (Number(year) * 12 + months.indexOf(monthName));
    for (let step = 0; step < Math.abs(delta); step += 1) {
      fireEvent.click(within(calendar).getByRole("button", { name: delta > 0 ? "Próximo mês" : "Mês anterior" }));
    }
    expect(within(calendar).getByText("Setembro de 2026")).toBeInTheDocument();
    fireEvent.click(within(calendar).getByRole("button", { name: /Dia 24: 1 publicação/ }));
    expect(screen.getByText("Legenda b")).toBeInTheDocument();
    expect(screen.queryByText("Legenda a")).not.toBeInTheDocument();
  });
});
