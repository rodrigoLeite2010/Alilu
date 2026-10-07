import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/instagram/content-automation/MediaPicker", () => ({
  MediaPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("media-1")}>
      Escolher mídia
    </button>
  ),
}));

const { AutomationWizard } = await import("@/components/instagram/content-automation/AutomationWizard");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AutomationWizard — Prompt único recorrente", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    push.mockReset();
    vi.restoreAllMocks();
  });

  it("cria a automação, grava prompt + agenda em UMA chamada e ativa", async () => {
    const calls: { url: string; body: Record<string, unknown> | null }[] = [];
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (init?.method === "POST") return jsonResponse({ id: "auto-1" }, 201);
      return jsonResponse({ status: "ACTIVE" });
    }) as typeof fetch;

    render(<AutomationWizard userId="u1" accounts={[{ id: "acc-1", igUsername: "alilu" }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar" })); // conta
    fireEvent.change(screen.getByLabelText("Nome da automação"), { target: { value: "Reflexão diária" } });
    fireEvent.click(screen.getByRole("radio", { name: /Prompt único recorrente/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" })); // marca e modo

    // Sem prompt não avança.
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escreva o prompt do conteúdo.");

    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "Crie uma reflexão motivacional." } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Defina a imagem padrão");

    fireEvent.click(screen.getByRole("button", { name: "Escolher mídia" }));
    // Agenda padrão: todos os dias às 08:00 (7 execuções); acrescenta 12:00.
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar horário" }));
    expect(screen.getAllByText("14 execuções por semana").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    fireEvent.click(screen.getByRole("button", { name: "Criar e ativar automação" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/instagram/piloto-automatico/automacoes/auto-1"));

    const create = calls[0];
    expect(create.url).toBe("/api/content-automation/automations");
    expect(create.body).toMatchObject({ scheduleMode: "SHARED_PROMPT", name: "Reflexão diária", fixedImageMediaId: "media-1" });

    const shared = calls[1];
    expect(shared.url).toBe("/api/content-automation/automations/auto-1");
    expect(shared.body).toMatchObject({
      action: "update-shared",
      content: { prompt: "Crie uma reflexão motivacional.", contentType: "POST", contentMode: "AI" },
      schedule: { times: ["08:00", "12:00"] },
    });
    expect((shared.body?.schedule as { days: string[] }).days).toHaveLength(7);

    // Nenhuma chamada por dia: só criar, salvar prompt+agenda e ativar.
    expect(calls).toHaveLength(3);
    expect(calls[2].body).toEqual({ action: "activate" });
  });

  it("no modo Personalizado por dia o fluxo antigo continua (sem update-shared)", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ id: "auto-2" }, 201)) as typeof fetch;
    render(<AutomationWizard userId="u1" accounts={[{ id: "acc-1", igUsername: "alilu" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("radio", { name: /Personalizado por dia/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Nome da automação"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Configure sua semana")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Resumo da automação" })).not.toBeInTheDocument();
  });
});
