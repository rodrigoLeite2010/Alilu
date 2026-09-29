import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomeSearch } from "@/components/home/HomeSearch";

describe("HomeSearch", () => {
  it("não mostra resultados antes de digitar nada", () => {
    render(<HomeSearch />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("filtra ferramentas do catálogo de utilitários pelo nome", () => {
    render(<HomeSearch />);
    const field = screen.getByPlaceholderText(/qual ferramenta você precisa/i);

    fireEvent.change(field, { target: { value: "cpf" } });

    expect(screen.getByRole("link", { name: /gerador de cpf/i })).toBeInTheDocument();
  });

  it("também encontra ferramentas de Instagram (catálogo separado)", () => {
    render(<HomeSearch />);
    const field = screen.getByPlaceholderText(/qual ferramenta você precisa/i);

    fireEvent.change(field, { target: { value: "instagram" } });

    expect(screen.getAllByText("Instagram").length).toBeGreaterThan(0);
  });

  it('mostra mensagem clara quando nada é encontrado', () => {
    render(<HomeSearch />);
    const field = screen.getByPlaceholderText(/qual ferramenta você precisa/i);

    fireEvent.change(field, { target: { value: "xyzxyzxyz-nao-existe" } });

    expect(screen.getByText(/nenhuma ferramenta encontrada/i)).toBeInTheDocument();
  });

  it("limpar o campo esconde os resultados de novo", () => {
    render(<HomeSearch />);
    const field = screen.getByPlaceholderText(/qual ferramenta você precisa/i);

    fireEvent.change(field, { target: { value: "pdf" } });
    expect(screen.getByRole("region")).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "" } });
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
