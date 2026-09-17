import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorCartaoCreditoTool } from "@/components/tools/validador-cartao-credito/ValidadorCartaoCreditoTool";

describe("ValidadorCartaoCreditoTool", () => {
  it("mostra número válido (Luhn) e identifica a bandeira Visa", () => {
    render(<ValidadorCartaoCreditoTool />);
    fireEvent.change(screen.getByLabelText("Número do cartão"), {
      target: { value: "4242424242424242" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar cartão/i }));

    const status = screen.getByRole("status");
    expect(within(status).getByText(/válido \(luhn\)/i)).toBeInTheDocument();
    expect(within(status).getByText(/Visa/)).toBeInTheDocument();
  });

  it("aceita o número com espaços", () => {
    render(<ValidadorCartaoCreditoTool />);
    fireEvent.change(screen.getByLabelText("Número do cartão"), {
      target: { value: "4242 4242 4242 4242" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar cartão/i }));

    expect(within(screen.getByRole("status")).getByText(/válido \(luhn\)/i)).toBeInTheDocument();
  });

  it("mostra número inválido para um número que falha no Luhn", () => {
    render(<ValidadorCartaoCreditoTool />);
    fireEvent.change(screen.getByLabelText("Número do cartão"), {
      target: { value: "4242424242424241" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar cartão/i }));

    expect(within(screen.getByRole("status")).getByText(/inválido \(luhn\)/i)).toBeInTheDocument();
  });

  it("não pede validade, CVV ou nome do titular", () => {
    render(<ValidadorCartaoCreditoTool />);
    expect(screen.queryByLabelText(/cvv/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/validade/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorCartaoCreditoTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar cartão/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("o botão Limpar reseta o campo e o resultado", () => {
    render(<ValidadorCartaoCreditoTool />);
    fireEvent.change(screen.getByLabelText("Número do cartão"), {
      target: { value: "4242424242424242" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar cartão/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Número do cartão") as HTMLInputElement).value).toBe("");
  });
});
