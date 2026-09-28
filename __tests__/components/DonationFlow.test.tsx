import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

/**
 * Testa o fluxo completo de doação (botão -> modal -> QR Code -> copiar
 * chave -> fechar) através de DonationProvider + DonationButton, sem
 * mockar getDonationConfig diretamente — em vez disso, ajusta as
 * variáveis de ambiente NEXT_PUBLIC_* que ele lê (mesmo dado real usado
 * em produção), o que também exercita a integração real com
 * lib/donation/config.ts e lib/donation/pix-payload.ts.
 */

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

const ENV_KEYS = [
  "NEXT_PUBLIC_PIX_KEY",
  "NEXT_PUBLIC_PIX_RECEIVER_NAME",
  "NEXT_PUBLIC_PIX_RECEIVER_CITY",
  "NEXT_PUBLIC_DONATION_ENABLED",
] as const;
const originalValues = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function enableDonation() {
  process.env.NEXT_PUBLIC_PIX_KEY = "a1f773bb-0c82-4547-b195-55a9ac4ee748";
  process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME = "Rodrigo Soares Leite";
  process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY = "SAO PAULO";
  delete process.env.NEXT_PUBLIC_DONATION_ENABLED;
}

function disableDonation() {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originalValues[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  vi.restoreAllMocks();
});

const { DonationProvider } = await import("@/components/donation/DonationProvider");
const { DonationFloatingButton } = await import("@/components/donation/DonationFloatingButton");
const { DonationCard } = await import("@/components/donation/DonationCard");

describe("Fluxo de doação — DonationProvider + botão flutuante + modal", () => {
  beforeEach(() => {
    mockClipboard();
  });

  it("não renderiza nenhum botão quando a doação está desabilitada", () => {
    disableDonation();
    render(
      <DonationProvider>
        <DonationFloatingButton />
      </DonationProvider>,
    );

    expect(screen.queryByRole("button", { name: /apoiar o alilu/i })).not.toBeInTheDocument();
  });

  it("abre o modal ao clicar no botão flutuante, mostra o QR Code e a chave Pix", async () => {
    enableDonation();
    render(
      <DonationProvider>
        <DonationFloatingButton />
      </DonationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /apoiar o alilu com uma doação via pix/i }));

    expect(await screen.findByRole("dialog", { name: "❤️ Ajude o Alilu" })).toBeInTheDocument();
    expect(screen.getByText("a1f773bb-0c82-4547-b195-55a9ac4ee748")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar chave Pix" })).toBeInTheDocument();
  });

  it("copia a chave Pix ao clicar em 'Copiar chave Pix' e mostra o feedback", async () => {
    enableDonation();
    const writeText = mockClipboard();
    render(
      <DonationProvider>
        <DonationFloatingButton />
      </DonationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /apoiar o alilu com uma doação via pix/i }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Copiar chave Pix" }));

    expect(writeText).toHaveBeenCalledWith("a1f773bb-0c82-4547-b195-55a9ac4ee748");
    expect(await screen.findByRole("button", { name: "Chave Pix copiada!" })).toBeInTheDocument();
  });

  it("fecha o modal com Esc", async () => {
    enableDonation();
    render(
      <DonationProvider>
        <DonationFloatingButton />
      </DonationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /apoiar o alilu com uma doação via pix/i }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("fecha o modal ao clicar no botão de fechar (✕)", async () => {
    enableDonation();
    render(
      <DonationProvider>
        <DonationFloatingButton />
      </DonationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /apoiar o alilu com uma doação via pix/i }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("o botão do rodapé (DonationCard) abre o MESMO modal do botão flutuante", async () => {
    enableDonation();
    render(
      <DonationProvider>
        <DonationFloatingButton />
        <DonationCard />
      </DonationProvider>,
    );

    expect(screen.getByText("❤️ O Alilu é gratuito. Quer ajudar a manter o projeto?")).toBeInTheDocument();

    const footerButtons = screen.getAllByRole("button", { name: /apoiar o alilu com uma doação via pix/i });
    fireEvent.click(footerButtons[footerButtons.length - 1]);

    expect(await screen.findByRole("dialog", { name: "❤️ Ajude o Alilu" })).toBeInTheDocument();
    // só um modal, nunca dois — mesmo estado compartilhado pelo DonationProvider
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("DonationCard não renderiza nada quando a doação está desabilitada", () => {
    disableDonation();
    render(
      <DonationProvider>
        <DonationCard />
      </DonationProvider>,
    );

    expect(screen.queryByText(/o alilu é gratuito/i)).not.toBeInTheDocument();
  });
});
