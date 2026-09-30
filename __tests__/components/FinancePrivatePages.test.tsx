import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const { default: DespesasPage } = await import("@/app/financeiro/(privado)/despesas/page");
const { default: MeuOrcamentoPage } = await import("@/app/financeiro/(privado)/meu-orcamento/page");
const { default: AssinaturasPage } = await import("@/app/financeiro/(privado)/assinaturas/page");
const { default: PlanejamentoAnualPage } = await import("@/app/financeiro/(privado)/planejamento-anual/page");
const { default: MetodoEnvelopesPage } = await import("@/app/financeiro/(privado)/metodo-envelopes/page");

describe("páginas privadas de Educação Financeira", () => {
  beforeEach(() => {
    authMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ entries: [], occurrences: [], month: "2026-09", today: "2026-09-25", savingsGoalCents: 0, openingBalanceCents: 0 }),
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sem sessão: cada página pede login devolvendo para a própria URL, sem consultar a API", async () => {
    authMock.mockResolvedValue(null);

    render(await DespesasPage());
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toHaveAttribute(
      "href",
      "/entrar?callbackUrl=%2Ffinanceiro%2Fdespesas",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sem sessão, em outra página: o retorno aponta para essa página, não sempre para o orçamento", async () => {
    authMock.mockResolvedValue(null);
    render(await MeuOrcamentoPage());
    expect(screen.getByRole("link", { name: "Entrar ou criar conta" })).toHaveAttribute(
      "href",
      "/entrar?callbackUrl=%2Ffinanceiro%2Fmeu-orcamento",
    );
  });

  it("logado: mostra o título, as abas e o botão de adicionar gasto — sem o aviso de login", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    render(await DespesasPage());

    expect(screen.getByRole("heading", { name: "Despesas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Metas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Adicionar gasto" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Entrar ou criar conta" })).not.toBeInTheDocument();
  });

  it("aba Assinaturas leva à página de assinaturas, e a página em si mostra o título certo", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    render(await DespesasPage());
    expect(screen.getByRole("link", { name: "Assinaturas" })).toHaveAttribute("href", "/financeiro/assinaturas");

    render(await AssinaturasPage());
    expect(screen.getByRole("heading", { name: "Assinaturas mensais" })).toBeInTheDocument();
  });

  it("aba Planejamento anual leva à página certa, e a página em si mostra o título certo", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    render(await DespesasPage());
    expect(screen.getByRole("link", { name: "Planejamento anual" })).toHaveAttribute("href", "/financeiro/planejamento-anual");

    render(await PlanejamentoAnualPage());
    expect(screen.getByRole("heading", { name: "Planejamento anual" })).toBeInTheDocument();
  });

  it("aba Envelopes leva à página do Método dos envelopes, e a página em si mostra o título certo", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    render(await DespesasPage());
    expect(screen.getByRole("link", { name: "Envelopes" })).toHaveAttribute("href", "/financeiro/metodo-envelopes");

    render(await MetodoEnvelopesPage());
    expect(screen.getByRole("heading", { name: "Método dos envelopes" })).toBeInTheDocument();
  });
});
