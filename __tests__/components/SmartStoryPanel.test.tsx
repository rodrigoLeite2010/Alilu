import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SmartStoryPanel } from "@/components/instagram/content-automation/SmartStoryPanel";
import { defaultSmartStoryConfig } from "@/lib/content-automation/smart-story/config";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const previewBody = {
  dataUrl: "data:image/jpeg;base64,AAAA",
  content: { type: "REFLECTION", headline: "Recomeçar é coragem" },
  plan: { type: "REFLECTION", theme: "vida", useMascot: false },
  source: "AI",
};

function setup(enabled = false) {
  return render(
    <SmartStoryPanel
      automationId="auto-1"
      initial={{ enabled, config: defaultSmartStoryConfig() }}
      basePrompt="gratidão"
      brandContext=""
      previewTime="08:00"
    />,
  );
}

describe("SmartStoryPanel", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("desligado: só mostra o checkbox e o salvar", () => {
    setup(false);
    expect(screen.getByRole("checkbox", { name: /Modo inteligente de Stories/ })).not.toBeChecked();
    expect(screen.queryByText("Estilo automático")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar exemplo" })).not.toBeInTheDocument();
  });

  it("ligado: mostra estilo automático, avançado recolhido e a nota honesta sobre figurinhas", () => {
    setup(true);
    expect(screen.getByText("Estilo automático")).toBeInTheDocument();
    expect(screen.getByText(/não permite publicar figurinhas interativas/)).toBeInTheDocument();
    expect(screen.getByText("Opções avançadas").closest("details")).not.toHaveAttribute("open");
  });

  it("salva com a ação update-smart-story", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return json({ automation: {} });
    }) as typeof fetch;
    setup(false);
    fireEvent.click(screen.getByRole("checkbox", { name: /Modo inteligente de Stories/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar modo inteligente" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/content-automation/automations/auto-1");
    expect(calls[0].body).toMatchObject({ action: "update-smart-story", enabled: true });
    expect(await screen.findByRole("status")).toHaveTextContent(/modo inteligente/i);
  });

  it("gera exemplo, vira 'Gerar outro' e envia os tipos já mostrados", async () => {
    const bodies: Record<string, unknown>[] = [];
    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return json(previewBody);
    }) as typeof fetch;
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Gerar exemplo" }));
    expect(await screen.findByAltText(/Exemplo de Story: Recomeçar é coragem/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gerar outro" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0].previousTypes).toEqual([]);
    expect(bodies[1].previousTypes).toEqual(["REFLECTION"]);
    expect(bodies[1]).toMatchObject({ basePrompt: "gratidão", time: "08:00" });
  });

  it("mostra a mensagem de erro da API (ex.: sem assinatura)", async () => {
    global.fetch = vi.fn(async () => json({ error: "Assine para continuar." }, 403)) as typeof fetch;
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Gerar exemplo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Assine para continuar.");
  });

  it("nunca deixa desmarcar o último tipo", () => {
    setup(true);
    const details = screen.getByText("Opções avançadas").closest("details")!;
    const boxes = Array.from(details.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).slice(0, 11);
    boxes.slice(1).forEach((box) => fireEvent.click(box));
    expect(boxes[0]).toBeChecked();
    fireEvent.click(boxes[0]);
    expect(boxes[0]).toBeChecked();
  });
});
