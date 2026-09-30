import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanilhasDownloads } from "@/components/financas/PlanilhasDownloads";

const SLUGS = ["orcamento-mensal", "planejamento-anual", "controle-de-dividas", "metodo-envelopes"];

describe("PlanilhasDownloads", () => {
  it("mostra os 4 modelos, cada um com link para baixar XLSX e CSV", () => {
    render(<PlanilhasDownloads />);

    expect(screen.getByText("Orçamento mensal")).toBeInTheDocument();
    expect(screen.getByText("Planejamento anual")).toBeInTheDocument();
    expect(screen.getByText("Controle de dívidas")).toBeInTheDocument();
    expect(screen.getByText("Método dos envelopes")).toBeInTheDocument();

    const xlsxLinks = screen.getAllByRole("link", { name: "Baixar XLSX" });
    const csvLinks = screen.getAllByRole("link", { name: "Baixar CSV" });
    expect(xlsxLinks).toHaveLength(4);
    expect(csvLinks).toHaveLength(4);
    for (const slug of SLUGS) {
      expect(xlsxLinks.some((a) => a.getAttribute("href") === `/planilhas/${slug}.xlsx`)).toBe(true);
      expect(csvLinks.some((a) => a.getAttribute("href") === `/planilhas/${slug}.csv`)).toBe(true);
    }
  });

  it("os 8 arquivos estáticos (xlsx + csv de cada modelo) existem em public/planilhas", () => {
    for (const slug of SLUGS) {
      for (const ext of ["xlsx", "csv"]) {
        const path = join(process.cwd(), "public", "planilhas", `${slug}.${ext}`);
        expect(existsSync(path), `esperava encontrar ${path}`).toBe(true);
        expect(statSync(path).size, `${path} está vazio`).toBeGreaterThan(0);
      }
    }
  });
});
