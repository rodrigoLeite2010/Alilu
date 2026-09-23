import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: routerPush }) }));
const routerPush = vi.fn();

const draftStore = {
  loadLocalDraft: vi.fn().mockResolvedValue(null),
  saveLocalDraft: vi.fn().mockResolvedValue(undefined),
  clearLocalDraft: vi.fn().mockResolvedValue(undefined),
  loadLocalValue: vi.fn().mockResolvedValue(null),
  saveLocalValue: vi.fn().mockResolvedValue(undefined),
};
vi.mock("@/lib/instagram/draft-store", () => draftStore);

const { default: InstagramCategoryPage } = await import("@/app/instagram/page");
const { default: HomePage } = await import("@/app/page");
const { SiteSidebar } = await import("@/components/navigation/SiteNav");
const { PublicPostCreator } = await import("@/components/instagram/PublicPostCreator");
const { PublicCarouselCreator } = await import("@/components/instagram/PublicCarouselCreator");
const { ReelsComposer } = await import("@/components/instagram/ReelsComposer");
const { createInitialEditorState, serializeEditorState, updateTextValue } = await import("@/lib/instagram/editor-state");

function stubAccount(body: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
}

const originalLocation = window.location;
afterEach(() => {
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("descoberta da publicação automática", () => {
  it("categoria Instagram: H1, CTAs, como funciona, card de publicação automática e só formatos reais", () => {
    render(<InstagramCategoryPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Crie, agende e publique no Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar post grátis" })).toHaveAttribute("href", "/instagram/criar-post");
    expect(screen.getAllByRole("link", { name: /Agendar/ })[0]).toHaveAttribute("href", "/instagram/painel/calendario");
    expect(screen.getAllByRole("link", { name: "Conectar Instagram" })[0].getAttribute("href")).toMatch(/^\/api\/instagram\/oauth\/start\?returnTo=/);
    expect(screen.getByRole("heading", { name: "Como funciona" })).toBeInTheDocument();
    expect(screen.getByText("Publicação automática")).toBeInTheDocument();
    for (const format of ["Post de imagem", "Carrossel", "Reels", "Agendamento"]) {
      expect(screen.getAllByText(format).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/ainda não disponível pela publicação automática: stories/i)).toBeInTheDocument();
    // O calendário já existe: não pode aparecer como "em breve".
    expect(screen.queryByText("Calendário de Publicações")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Posts Virais/ })).toHaveAttribute("href", "/instagram/posts-virais");
  });

  it("home: chamada compacta para criar e publicar no Instagram", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Crie e publique no Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar post agora" })).toHaveAttribute("href", "/instagram/criar-post");
    expect(screen.getByRole("link", { name: "Conhecer publicação automática" })).toHaveAttribute("href", "/instagram#publicacao-automatica");
  });

  it("menu: 'Agendar e publicar' sempre visível sob Instagram", () => {
    render(<SiteSidebar />);
    expect(screen.getByRole("link", { name: "Agendar e publicar" })).toHaveAttribute("href", "/instagram/painel/calendario");
  });
});

describe("Criador de Posts público", () => {
  it("sem login: download e também Publicar/Agendar; clicar abre a etapa de conexão e guarda a arte", async () => {
    stubAccount({ authenticated: false, connected: false, username: null });
    render(<PublicPostCreator />);
    expect(screen.getByText("Seu post está pronto!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar PNG" })).toBeInTheDocument();
    await screen.findByText(/Você só conecta sua conta na hora de publicar/);

    fireEvent.click(screen.getByRole("button", { name: "Publicar no Instagram" }));
    const gate = await screen.findByRole("dialog", { name: "Conecte seu Instagram para continuar" });
    Object.defineProperty(window, "location", { value: { ...window.location, href: "" }, writable: true, configurable: true });
    fireEvent.click(within(gate).getByRole("button", { name: "Entrar e conectar Instagram" }));
    await waitFor(() => expect(draftStore.saveLocalDraft).toHaveBeenCalledWith(expect.objectContaining({ mode: "now" }), "post"));
  });

  it("volta do login/conexão (?continuar=1): restaura a arte e a legenda", async () => {
    stubAccount({ authenticated: true, connected: true, username: "alilu.tec", userId: "u1" });
    window.history.replaceState(null, "", "/instagram/criar-post?continuar=1&status=conectado");
    draftStore.loadLocalDraft.mockResolvedValueOnce({
      viralTemplateId: null,
      editor: serializeEditorState(updateTextValue(createInitialEditorState("comunicado"), "heading", "Título restaurado")),
      caption: "Legenda restaurada",
      mode: "schedule",
      schedule: { date: "2099-01-01", time: "10:00" },
      image: null,
      savedAt: Date.now(),
    });
    render(<PublicPostCreator />);
    expect(await screen.findByText(/Instagram conectado! Sua arte foi restaurada/)).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Título restaurado")).toBeInTheDocument();
    expect(screen.getByLabelText("Legenda")).toHaveValue("Legenda restaurada");
  });
});

describe("Carrossel e Reels públicos", () => {
  it("carrossel sem conta: Publicar/Agendar visíveis e levam à conexão guardando os slides", async () => {
    stubAccount({ authenticated: false, connected: false, username: null });
    render(<PublicCarouselCreator />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Publicar no Instagram" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Publicar no Instagram" }));
    const gate = await screen.findByRole("dialog", { name: "Conecte seu Instagram para continuar" });
    Object.defineProperty(window, "location", { value: { ...window.location, href: "" }, writable: true, configurable: true });
    fireEvent.click(within(gate).getByRole("button", { name: "Entrar e conectar Instagram" }));
    await waitFor(() => expect(draftStore.saveLocalValue).toHaveBeenCalledWith("carousel", expect.objectContaining({ slides: expect.any(Array) })));
    await waitFor(() => expect(window.location.href).toMatch(/^\/entrar\?callbackUrl=.*carrossel%253Fcontinuar%253D1/));
  });

  it("Reels logado sem Instagram: pede conexão em vez de falhar", async () => {
    render(<ReelsComposer userId="u1" instagramConnected={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));
    const gate = await screen.findByRole("dialog", { name: "Conecte seu Instagram para continuar" });
    fireEvent.click(within(gate).getByRole("button", { name: "Conectar Instagram" }));
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/api/instagram/oauth/start?returnTo=%2Finstagram%2Freels%3Fcontinuar%3D1"));
  });
});
