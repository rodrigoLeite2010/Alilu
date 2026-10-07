import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AutomationDetailDto } from "@/components/instagram/content-automation/AutomationEditor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("@/components/instagram/content-automation/MediaPicker", () => ({ MediaPicker: () => null }));

const { AutomationEditor } = await import("@/components/instagram/content-automation/AutomationEditor");

function dto(overrides: Partial<AutomationDetailDto> = {}): AutomationDetailDto {
  return {
    id: "auto-1",
    instagramAccountId: "acc-1",
    name: "Reflexão diária",
    description: "",
    status: "PAUSED",
    timezone: "America/Sao_Paulo",
    brandContext: "",
    autoPublish: false,
    requireApproval: true,
    generationLeadMinutes: 120,
    imageMode: "FIXED_IMAGE",
    fixedImageMediaId: "media-1",
    fixedVideoMediaId: null,
    scheduleMode: "SHARED_PROMPT",
    shared: {
      dayOfWeek: "MONDAY",
      slotIndex: 0,
      enabled: true,
      publishTime: "09:00",
      contentCategory: null,
      contentType: "POST",
      contentMode: "AI",
      prompt: "Prompt antigo",
      manualCaption: "",
      visualText: "",
      templateId: null,
      overlayOpacity: null,
      visualTextColor: null,
      imageMediaId: null,
      videoMediaId: null,
    },
    schedule: { days: ["MONDAY", "TUESDAY"], times: ["08:00", "12:00"] },
    days: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AutomationEditor — Prompt único recorrente", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("edita o prompt UMA vez e salva prompt + agenda numa única chamada", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return jsonResponse({ weeklyExecutions: 6 });
    }) as typeof fetch;

    render(<AutomationEditor userId="u1" automation={dto()} pendingRuns={[]} />);
    expect(screen.queryByText("Semana")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Prompt")).toHaveValue("Prompt antigo");

    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "Prompt NOVO" } });
    fireEvent.click(screen.getByRole("button", { name: "Quarta-feira" })); // acrescenta quarta
    fireEvent.click(screen.getByRole("button", { name: "Salvar prompt e agenda" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("6 execuções por semana"));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/content-automation/automations/auto-1");
    expect(calls[0].body).toMatchObject({
      action: "update-shared",
      content: { prompt: "Prompt NOVO" },
      schedule: { days: ["MONDAY", "TUESDAY", "WEDNESDAY"], times: ["08:00", "12:00"] },
    });
  });

  it("não salva agenda inválida (sem dias) e mostra o erro sem chamar a API", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<AutomationEditor userId="u1" automation={dto({ schedule: { days: [], times: ["08:00"] } })} pendingRuns={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar prompt e agenda" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos um dia da semana.");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("só troca de modo pausada e com confirmação", async () => {
    const calls: Record<string, unknown>[] = [];
    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return jsonResponse({});
    }) as typeof fetch;

    const { unmount } = render(<AutomationEditor userId="u1" automation={dto({ status: "ACTIVE" })} pendingRuns={[]} />);
    expect(screen.getByText("Pause a automação para trocar de modo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mudar para Personalizado/ })).not.toBeInTheDocument();
    unmount();

    render(<AutomationEditor userId="u1" automation={dto()} pendingRuns={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mudar para Personalizado por dia" }));
    expect(calls).toHaveLength(0); // ainda não trocou: pede confirmação
    fireEvent.click(screen.getByRole("button", { name: "Confirmar troca" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(calls).toEqual([{ action: "update", scheduleMode: "CUSTOM" }]);
  });

  it("no modo Personalizado a tela da semana continua aparecendo", () => {
    render(
      <AutomationEditor
        userId="u1"
        automation={dto({
          scheduleMode: "CUSTOM",
          days: [
            {
              id: "d1",
              dayOfWeek: "MONDAY",
              slotIndex: 0,
              enabled: true,
              contentCategory: null,
              contentType: "POST",
              contentMode: "AI",
              prompt: "Prompt de segunda",
              manualCaption: "",
              visualText: "",
              templateId: null,
              overlayOpacity: null,
              visualTextColor: null,
              publishTime: "08:00",
              imageMediaId: null,
              videoMediaId: null,
            },
          ],
        })}
        pendingRuns={[]}
      />,
    );
    expect(screen.getByText("Semana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar semana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar prompt e agenda" })).not.toBeInTheDocument();
  });
});
