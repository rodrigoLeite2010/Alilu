import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AutomationDetailDto } from "@/components/instagram/content-automation/AutomationEditor";
import { defaultSmartStoryConfig } from "@/lib/content-automation/smart-story/config";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/instagram/content-automation/MediaPicker", () => ({ MediaPicker: () => <div data-testid="media-picker" /> }));

const { AutomationEditor } = await import("@/components/instagram/content-automation/AutomationEditor");

function dto(overrides: Partial<AutomationDetailDto> = {}, shared: Partial<AutomationDetailDto["shared"]> = {}): AutomationDetailDto {
  return {
    id: "auto-1",
    instagramAccountId: "acc-1",
    name: "Stories",
    description: "",
    status: "PAUSED",
    timezone: "America/Sao_Paulo",
    brandContext: "",
    autoPublish: false,
    requireApproval: true,
    generationLeadMinutes: 120,
    imageMode: "AUTO_TEMPLATE",
    fixedImageMediaId: "media-1",
    fixedVideoMediaId: null,
    scheduleMode: "SHARED_PROMPT",
    shared: {
      dayOfWeek: "MONDAY",
      slotIndex: 0,
      enabled: true,
      publishTime: "09:00",
      contentCategory: null,
      contentType: "STORY",
      contentMode: "AI",
      prompt: "Gratidão",
      manualCaption: "",
      visualText: "",
      templateId: null,
      overlayOpacity: null,
      visualTextColor: null,
      imageMediaId: "media-2",
      videoMediaId: null,
      ...shared,
    },
    schedule: { days: ["MONDAY"], times: ["09:00"] },
    days: [],
    smartStory: { enabled: false, config: defaultSmartStoryConfig() },
    ...overrides,
  };
}

const legacyTexts = [
  /Como definir a imagem dos posts/,
  /Foto de fundo padrão/,
  /Imagem fixa/,
  /Biblioteca de imagens/,
  /Gerar com IA sobre a imagem/,
  /Véu sobre a foto/,
  /Usar uma imagem diferente do padrão/,
  /Como gerar o texto do Story/,
];

function setSmart(value: boolean) {
  const box = screen.getByRole("checkbox", { name: /Modo inteligente de Stories/ });
  if ((box as HTMLInputElement).checked !== value) fireEvent.click(box);
}

describe("AutomationEditor — modo inteligente × fluxo manual de Stories", () => {
  afterEach(() => vi.restoreAllMocks());

  it("modo inteligente DESLIGADO: mostra todo o fluxo antigo de imagem", () => {
    render(<AutomationEditor userId="u1" automation={dto()} pendingRuns={[]} />);
    for (const text of legacyTexts) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });

  it("modo inteligente LIGADO desde o início: esconde (não só desabilita) tudo do fluxo manual", () => {
    render(<AutomationEditor userId="u1" automation={dto({ smartStory: { enabled: true, config: defaultSmartStoryConfig() } })} pendingRuns={[]} />);
    for (const text of legacyTexts) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.queryByTestId("media-picker")).not.toBeInTheDocument();
    expect(screen.getByText("Prompt base")).toBeInTheDocument();
    expect(screen.getByText(/os templates e fundos são escolhidos automaticamente/)).toBeInTheDocument();
    // O que continua visível no modo inteligente.
    expect(screen.getByText("Modo aprovação")).toBeInTheDocument();
    expect(screen.getByText(/Gerar com antecedência/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar configurações" })).toBeInTheDocument();
    expect(screen.getByText("Dias da semana")).toBeInTheDocument();
    expect(screen.getByText("Horários")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar exemplo" })).toBeInTheDocument();
  });

  it("manual → inteligente → manual: o fluxo antigo some e VOLTA (valores preservados)", () => {
    render(<AutomationEditor userId="u1" automation={dto()} pendingRuns={[]} />);
    setSmart(true);
    for (const text of legacyTexts) expect(screen.queryByText(text)).not.toBeInTheDocument();
    setSmart(false);
    for (const text of legacyTexts) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("media-picker").length).toBeGreaterThan(0);
  });

  it("ligar o modo inteligente num Story salvo como MANUAL volta para IA + prompt base", () => {
    render(<AutomationEditor userId="u1" automation={dto({}, { contentMode: "MANUAL", manualCaption: "", visualText: "Frase" })} pendingRuns={[]} />);
    setSmart(true);
    expect(screen.getByText("Prompt base")).toBeInTheDocument();
    expect(screen.queryByText(/Texto do Story \(opcional\)/)).not.toBeInTheDocument();
  });

  it("Post continua com imagem mesmo com o modo inteligente ligado (só Story é afetado)", () => {
    render(
      <AutomationEditor
        userId="u1"
        automation={dto({ smartStory: { enabled: true, config: defaultSmartStoryConfig() } }, { contentType: "POST" })}
        pendingRuns={[]}
      />,
    );
    expect(screen.queryByText(/Modo inteligente de Stories/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Como definir a imagem dos posts/).length).toBeGreaterThan(0);
  });

  it("responsivo: painel e botões usam coluna única + alvos de toque (min-h-11) no celular", () => {
    const { container } = render(<AutomationEditor userId="u1" automation={dto({ smartStory: { enabled: true, config: defaultSmartStoryConfig() } })} pendingRuns={[]} />);
    const panel = screen.getByRole("region", { name: "Modo inteligente de Stories" });
    expect(panel.querySelector("button")?.className).toContain("min-h-11");
    expect(panel.querySelector(".grid")?.className ?? "").toMatch(/sm:grid-cols/);
    expect(container.innerHTML).not.toMatch(/overflow-x-scroll/);
  });
});
