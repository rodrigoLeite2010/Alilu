import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MobileHome } from "@/components/mobile/MobileHome";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function mockMobileViewport(isMobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: isMobile,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function mockFetch(routes: Record<string, unknown>) {
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    const body = routes[url];
    return body === undefined ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => body };
  }) as unknown as typeof fetch;
}

describe("MobileHome", () => {
  const originalFetch = global.fetch;
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    global.fetch = originalFetch;
    window.matchMedia = originalMatchMedia;
  });

  it("é oculta no desktop por CSS e mostra as 4 ações principais", async () => {
    mockMobileViewport(true);
    mockFetch({ "/api/auth/session": {} });
    const { container } = render(<MobileHome />);

    expect(container.firstElementChild).toHaveClass("md:hidden");
    expect(await screen.findByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
    expect(screen.getByRole("link", { name: /Criar Post/ })).toHaveAttribute("href", "/instagram/criar-post");
    expect(screen.getByRole("link", { name: /Criar Reel/ })).toHaveAttribute("href", "/instagram/reels");
    expect(screen.getByRole("link", { name: /Criar Carrossel/ })).toHaveAttribute("href", "/instagram/carrossel");
    expect(screen.getByRole("link", { name: /Agenda/ })).toHaveAttribute("href", "/agenda");
  });

  it("deslogado: não chama as APIs de automação nem de publicações", async () => {
    mockMobileViewport(true);
    mockFetch({ "/api/auth/session": {} });
    render(<MobileHome />);
    await screen.findByRole("link", { name: "Entrar" });

    const urls = vi.mocked(global.fetch).mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(["/api/auth/session"]);
  });

  it("logado no celular: saudação, automação e últimas atividades com status em texto", async () => {
    mockMobileViewport(true);
    mockFetch({
      "/api/auth/session": { user: { name: "Rodrigo Leite", email: "r@exemplo.com", image: null } },
      "/api/content-automation/automations": {
        automations: [
          { id: "a1", name: "Diário", status: "ACTIVE", timezone: "America/Sao_Paulo", nextRunAt: "2099-01-01T21:00:00.000Z" },
        ],
      },
      "/api/instagram/posts": {
        posts: [
          { id: "p1", postType: "reels", status: "PUBLISHED", caption: "Educação financeira", scheduledAtUtc: null, publishedAt: "2026-10-05T21:30:00.000Z", createdAt: "2026-10-05T20:00:00.000Z", timezone: "America/Sao_Paulo" },
          { id: "p2", postType: "image", status: "SCHEDULED", caption: "", scheduledAtUtc: "2099-01-02T21:00:00.000Z", publishedAt: null, createdAt: "2026-10-05T20:00:00.000Z", timezone: "America/Sao_Paulo" },
          { id: "p3", postType: "carousel", status: "CANCELLED", caption: "Cancelado", scheduledAtUtc: null, publishedAt: null, createdAt: "2026-10-05T20:00:00.000Z", timezone: "America/Sao_Paulo" },
        ],
      },
    });
    render(<MobileHome />);

    expect(await screen.findByText("Olá, Rodrigo")).toBeInTheDocument();
    expect(await screen.findByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText(/^Próxima:/)).toBeInTheDocument();

    const activity = screen.getByRole("list", { name: "Últimas atividades" });
    const cards = within(activity).getAllByRole("link");
    expect(cards).toHaveLength(2); // cancelado não aparece
    expect(cards[0]).toHaveTextContent("Reel · Educação financeira");
    expect(cards[0]).toHaveTextContent("Publicado");
    expect(cards[1]).toHaveTextContent("Agendado");
    expect(cards[0]).toHaveAttribute("href", "/instagram/painel/calendario");
  });

  it("logado no desktop: não busca dados da home mobile", async () => {
    mockMobileViewport(false);
    mockFetch({ "/api/auth/session": { user: { name: "Ana", email: "a@exemplo.com", image: null } } });
    render(<MobileHome />);
    await screen.findByText("Olá, Ana");

    const urls = vi.mocked(global.fetch).mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(["/api/auth/session"]);
  });

  it("sem atividades mostra o estado vazio com ação", async () => {
    mockMobileViewport(true);
    mockFetch({
      "/api/auth/session": { user: { name: "Ana", email: "a@exemplo.com", image: null } },
      "/api/content-automation/automations": { automations: [] },
      "/api/instagram/posts": { posts: [] },
    });
    render(<MobileHome />);

    expect(await screen.findByText("Nenhuma atividade ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar automação" })).toHaveAttribute("href", "/instagram/piloto-automatico");
  });

  it('"Mais ferramentas" abre o sheet com as áreas do site', async () => {
    mockMobileViewport(true);
    mockFetch({ "/api/auth/session": {} });
    render(<MobileHome />);
    await screen.findByRole("link", { name: "Entrar" });

    fireEvent.click(screen.getByRole("button", { name: /mais ferramentas/i }));

    const dialog = screen.getByRole("dialog", { name: /mais ferramentas/i });
    expect(within(dialog).getByRole("link", { name: "Todas as ferramentas" })).toHaveAttribute("href", "/utilitarios");
    expect(within(dialog).getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "/instagram");
    expect(within(dialog).getByRole("link", { name: "Vídeos" })).toHaveAttribute("href", "/videos");
  });
});
