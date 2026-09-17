import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResumeBuilderTool } from "@/components/tools/resume-builder/ResumeBuilderTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("ResumeBuilderTool", () => {
  it("exige o nome completo antes de gerar o currículo", () => {
    render(<ResumeBuilderTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar currículo/i }));

    expect(screen.getByText(/informe seu nome completo/i)).toBeInTheDocument();
  });

  it("mostra a prévia do currículo com os dados preenchidos", () => {
    render(<ResumeBuilderTool />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText("Título profissional"), {
      target: { value: "Desenvolvedora Front-end" },
    });
    fireEvent.click(screen.getByRole("button", { name: /gerar currículo/i }));

    expect(screen.getByRole("heading", { name: "Maria Silva" })).toBeInTheDocument();
    expect(screen.getByText("Desenvolvedora Front-end")).toBeInTheDocument();
  });

  it("permite voltar para editar o currículo", () => {
    render(<ResumeBuilderTool />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar currículo/i }));
    fireEvent.click(screen.getByRole("button", { name: /editar currículo/i }));

    expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
  });

  it("permite copiar o currículo como texto", async () => {
    const writeText = mockClipboard();
    render(<ResumeBuilderTool />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar currículo/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar como texto/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Currículo copiado como texto!");
  });
});
