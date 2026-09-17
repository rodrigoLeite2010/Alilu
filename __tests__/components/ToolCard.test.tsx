import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolCard } from "@/components/tools/ToolCard";
import { tools } from "@/data/tools";

describe("ToolCard", () => {
  const tool = tools[0];
  // Após a EXECUÇÃO GERAL ALILU, todas as ferramentas do catálogo estão
  // "ativo" — não há mais nenhuma "em-breve" para reaproveitar aqui. O selo
  // "Em breve" é testado com uma ferramenta sintética (mesmo formato do
  // catálogo, só o status alterado), em vez de depender de o catálogo ter
  // alguma ferramenta pendente.
  const comingSoonTool = { ...tool, status: "em-breve" as const };

  it("exibe o nome curto, a descrição e o link correto da ferramenta", () => {
    render(<ToolCard tool={tool} />);

    expect(
      screen.getByRole("link", { name: new RegExp(tool.shortName) })
    ).toHaveAttribute("href", `/utilitarios/${tool.category}/${tool.slug}`);
    expect(screen.getByText(tool.description)).toBeInTheDocument();
  });

  it("mostra o selo \"Em breve\" para ferramentas ainda não disponíveis", () => {
    render(<ToolCard tool={comingSoonTool} />);
    expect(screen.getByText("Em breve")).toBeInTheDocument();
  });
});
