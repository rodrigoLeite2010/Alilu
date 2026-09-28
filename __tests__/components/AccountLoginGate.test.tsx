import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";

describe("AccountLoginGate", () => {
  it("deixa claro que as ferramentas continuam livres sem login e volta para /minha-conta depois do login", () => {
    render(<AccountLoginGate returnPath="/minha-conta" />);

    expect(screen.getByRole("heading", { name: "Entre para ver sua conta" })).toBeInTheDocument();
    expect(screen.getByText(/continuam livres para usar sem login/)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Entrar ou criar conta" });
    expect(link).toHaveAttribute("href", "/entrar?callbackUrl=%2Fminha-conta");
  });
});
