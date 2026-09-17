import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CertificateRegistryGeneratorTool } from "@/components/tools/certificate-registry-generator/CertificateRegistryGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("CertificateRegistryGeneratorTool", () => {
  it("gera um número de matrícula ao clicar em 'Gerar número de matrícula'", () => {
    render(<CertificateRegistryGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar número de matrícula/i }));

    expect(screen.getByText(/Matrícula gerada \(Certidão de Nascimento\)/i)).toBeInTheDocument();
  });

  it("mostra o aviso de que só o número é gerado, nunca um documento", () => {
    render(<CertificateRegistryGeneratorTool />);
    expect(screen.getByText(/nunca uma imagem ou documento de certidão/i)).toBeInTheDocument();
  });

  it("respeita o tipo de certidão escolhido", () => {
    render(<CertificateRegistryGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Tipo de certidão"), { target: { value: "obito" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar número de matrícula/i }));

    expect(screen.getByText(/Matrícula gerada \(Certidão de Óbito\)/i)).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<CertificateRegistryGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar número de matrícula/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<CertificateRegistryGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar número de matrícula/i }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os números copiados!");
  });
});
