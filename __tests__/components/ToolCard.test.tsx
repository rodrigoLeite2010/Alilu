import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolCard } from "@/components/tools/ToolCard";
import { tools } from "@/data/tools";

describe("ToolCard", () => {
  const tool = tools[0];

  it("exibe o nome curto, a descrição e o link correto da ferramenta", () => {
    render(<ToolCard tool={tool} />);

    expect(
      screen.getByRole("link", { name: new RegExp(tool.shortName) })
    ).toHaveAttribute("href", `/utilitarios/${tool.category}/${tool.slug}`);
    expect(screen.getByText(tool.description)).toBeInTheDocument();
  });

  it("mostra o selo \"Em breve\" para ferramentas ainda não disponíveis", () => {
    expect(tool.status).toBe("em-breve");
    render(<ToolCard tool={tool} />);
    expect(screen.getByText("Em breve")).toBeInTheDocument();
  });
});
