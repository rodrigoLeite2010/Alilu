import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const signInMock = vi.fn();
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

const { default: LoginPage } = await import("@/app/entrar/page");

/**
 * Testa a tela de login (e-mail + código, e Google) mockando `signIn` do
 * next-auth/react e o `fetch` para a rota de pedido de código — sem
 * bater em nenhum serviço de verdade.
 */
describe("LoginPage", () => {
  const originalLocation = window.location;
  const originalFetch = global.fetch;

  beforeEach(() => {
    signInMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    global.fetch = originalFetch;
  });

  it("começa na etapa de e-mail e mostra o botão do Google", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Código")).not.toBeInTheDocument();
  });

  it('clicar em "Continuar com Google" chama signIn("google", ...) com o callbackUrl do painel', () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Continuar com Google" }));

    expect(signInMock).toHaveBeenCalledWith("google", { callbackUrl: "/instagram/painel" });
  });

  it("pede um código, avança para a etapa de código e depois entra com sucesso", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    signInMock.mockResolvedValue({ error: null, ok: true });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "usuario@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar código por e-mail/i }));

    await waitFor(() => expect(screen.getByLabelText("Código")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/instagram/auth/request-code",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("email-otp", {
        email: "usuario@exemplo.com",
        code: "123456",
        redirect: false,
      }),
    );
    await waitFor(() => expect(window.location.href).toBe("/instagram/painel"));
  });

  it("mostra um erro quando a API recusa o pedido de código", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Informe um e-mail válido." }),
    }) as unknown as typeof fetch;

    render(<LoginPage />);

    // "usuario@localhost" passa na validação nativa do <input type="email">
    // do navegador (que não exige um "." no domínio) mas é rejeitado pela
    // nossa validação no servidor — assim o clique de fato dispara o
    // submit do form e a API mockada abaixo é quem recusa o e-mail.
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "usuario@localhost" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar código por e-mail/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um e-mail válido.");
    expect(screen.queryByLabelText("Código")).not.toBeInTheDocument();
  });

  it("mostra um erro quando o código informado está incorreto", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    signInMock.mockResolvedValue({ error: "CredentialsSignin", ok: false });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "usuario@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar código por e-mail/i }));
    await waitFor(() => expect(screen.getByLabelText("Código")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/código incorreto ou expirado/i);
    expect(window.location.href).toBe("");
  });

  it('"Usar outro e-mail" volta para a etapa de e-mail e limpa o código', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "usuario@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar código por e-mail/i }));
    await waitFor(() => expect(screen.getByLabelText("Código")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /usar outro e-mail/i }));

    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.queryByLabelText("Código")).not.toBeInTheDocument();
  });
});
