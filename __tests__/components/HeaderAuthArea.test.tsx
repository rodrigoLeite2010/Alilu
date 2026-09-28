import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeaderAuthArea } from "@/components/layout/HeaderAuthArea";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

/**
 * Área de autenticação do cabeçalho — busca GET /api/auth/session no
 * navegador (useHeaderAuth) e alimenta tanto o botão/menu de desktop
 * quanto o painel mobile. Cobre os três estados exigidos pela FASE 4 do
 * PROMPT: nunca mostra "Entrar" e troca bruscamente para o avatar (aqui
 * verificamos que o resultado final reflete a resposta da API), e trata
 * falha de rede como deslogado em vez de travar carregando para sempre.
 */
describe("HeaderAuthArea", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('mostra "Entrar" quando a sessão não tem usuário', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    render(<HeaderAuthArea />);

    expect(await screen.findByRole("link", { name: "Entrar" })).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/session");
  });

  it("mostra o menu da conta com o nome quando a sessão tem usuário", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { name: "Ana Souza", email: "ana@exemplo.com", image: null } }),
    }) as unknown as typeof fetch;

    render(<HeaderAuthArea />);

    expect(await screen.findByRole("button", { name: /Ana/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("trata falha ao buscar a sessão como deslogado, nunca trava em carregando", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;

    render(<HeaderAuthArea />);

    expect(await screen.findByRole("link", { name: "Entrar" })).toBeInTheDocument();
  });

  it('trata resposta sem e-mail (sessão sem usuário válido) como deslogado', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: {} }),
    }) as unknown as typeof fetch;

    render(<HeaderAuthArea />);

    expect(await screen.findByRole("link", { name: "Entrar" })).toBeInTheDocument();
  });
});
