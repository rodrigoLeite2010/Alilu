import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { CaptionGeneratorTool } from "@/components/tools/instagram-caption-generator/CaptionGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
  window.history.pushState({}, "", "/instagram/legendas");
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("CaptionGeneratorTool — geração (ETAPA 8/10)", () => {
  it("exige um assunto antes de gerar", () => {
    render(<CaptionGeneratorTool />);

    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    expect(screen.getByText(/digite o assunto do post/i)).toBeInTheDocument();
    expect(screen.queryByText(/opção 1/i)).not.toBeInTheDocument();
  });

  it("gera 3 opções de legenda depois de preencher o assunto", () => {
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    expect(screen.getByText("Opção 1")).toBeInTheDocument();
    expect(screen.getByText("Opção 2")).toBeInTheDocument();
    expect(screen.getByText("Opção 3")).toBeInTheDocument();
    expect(screen.getAllByText(/brownies veganos/i).length).toBeGreaterThanOrEqual(3);
  });

  it('"Gerar novas opções" produz um novo conjunto de legendas', () => {
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    const firstOptionText = screen.getByText("Opção 1").closest("div")?.parentElement?.textContent;

    fireEvent.click(screen.getByRole("button", { name: /gerar novas opções/i }));

    const secondOptionText = screen.getByText("Opção 1").closest("div")?.parentElement?.textContent;
    expect(secondOptionText).not.toBe(firstOptionText);
  });
});

describe("CaptionGeneratorTool — edição, cópia e contador independentes (ETAPA 11)", () => {
  it("editar uma opção não altera as outras", () => {
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    const originalSecondOptionText = screen.getByText("Opção 2").closest("div")!.parentElement!.textContent;

    fireEvent.click(screen.getAllByRole("button", { name: /^editar$/i })[0]);
    const textarea = screen.getByLabelText(/editar opção 1/i);
    fireEvent.change(textarea, { target: { value: "Texto totalmente reescrito pelo usuário." } });

    expect(textarea).toHaveValue("Texto totalmente reescrito pelo usuário.");
    const secondOptionAfterEdit = screen.getByText("Opção 2").closest("div")!.parentElement!.textContent;
    expect(secondOptionAfterEdit).toBe(originalSecondOptionText);
  });

  it("o contador de caracteres reflete o texto atual, inclusive depois de editar", () => {
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    fireEvent.click(screen.getAllByRole("button", { name: /^editar$/i })[0]);
    const textarea = screen.getByLabelText(/editar opção 1/i);
    fireEvent.change(textarea, { target: { value: "abc" } });

    const card = textarea.closest("div")!;
    expect(within(card).getByText(/^3 caracteres/)).toBeInTheDocument();
  });

  it("copiar envia exatamente o texto mostrado, preservando quebras de linha", async () => {
    const writeText = mockClipboard();
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    fireEvent.click(screen.getAllByRole("button", { name: /^copiar$/i })[0]);

    expect(await screen.findByText(/copiado!/i)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedText = writeText.mock.calls[0][0] as string;
    expect(copiedText).toContain("\n\n");
    expect(copiedText).toContain("brownies veganos");
  });

  it("copiar depois de editar envia o texto editado, não o original", async () => {
    const writeText = mockClipboard();
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    fireEvent.click(screen.getAllByRole("button", { name: /^editar$/i })[0]);
    fireEvent.change(screen.getByLabelText(/editar opção 1/i), { target: { value: "Legenda editada à mão." } });
    fireEvent.click(screen.getAllByRole("button", { name: /^copiar$/i })[0]);

    expect(writeText).toHaveBeenCalledWith("Legenda editada à mão.");
  });
});

describe("CaptionGeneratorTool — emojis e hashtags (ETAPA 10)", () => {
  it("desligar hashtags remove os # do texto gerado", () => {
    render(<CaptionGeneratorTool />);

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "brownies veganos" } });
    fireEvent.change(screen.getByLabelText("Sugerir hashtags"), { target: { value: "nao" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar legendas/i }));

    const firstCardText = screen.getByText("Opção 1").closest("div")!.parentElement!.textContent ?? "";
    expect(firstCardText).not.toContain("#");
  });
});

describe("CaptionGeneratorTool — integração (ETAPA 12)", () => {
  it("preenche o assunto automaticamente a partir do parâmetro ?assunto= da URL", () => {
    window.history.pushState({}, "", "/instagram/legendas?assunto=Carrossel%20sobre%20brownies");

    render(<CaptionGeneratorTool />);

    expect(screen.getByLabelText("Assunto")).toHaveValue("Carrossel sobre brownies");
  });

  it("mostra links para o Criador de Posts e o Criador de Carrosséis", () => {
    render(<CaptionGeneratorTool />);

    expect(screen.getByRole("link", { name: /criador de posts/i })).toHaveAttribute("href", "/instagram/criar-post");
    expect(screen.getByRole("link", { name: /criador de carrosséis/i })).toHaveAttribute(
      "href",
      "/instagram/carrossel"
    );
  });
});
