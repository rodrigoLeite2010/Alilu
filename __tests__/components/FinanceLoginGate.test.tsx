import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FinanceLoginGate } from "@/components/financas/FinanceLoginGate";

describe("FinanceLoginGate", () => {
  it("explica os dois jeitos de entrar e volta para a página certa depois do login", () => {
    render(<FinanceLoginGate returnPath="/financeiro/despesas" />);

    expect(screen.getByRole("heading", { name: "Entre para acessar sua Educação Financeira" })).toBeInTheDocument();
    expect(screen.getByText(/conta Google/)).toBeInTheDocument();
    expect(screen.getByText(/código de 6 dígitos/)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Entrar ou criar conta" });
    expect(link).toHaveAttribute("href", "/entrar?callbackUrl=%2Ffinanceiro%2Fdespesas");
  });
});
