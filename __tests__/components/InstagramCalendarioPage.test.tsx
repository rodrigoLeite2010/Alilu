import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const listPostsForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({
  listPostsForUser: (...args: unknown[]) => listPostsForUserMock(...args),
}));

const { default: CalendarioPage } = await import("@/app/instagram/painel/calendario/page");

describe("CalendarioPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    listPostsForUserMock.mockReset();
  });

  it("mostra o link de entrar quando não há sessão, sem consultar posts", async () => {
    authMock.mockResolvedValue(null);

    const jsx = await CalendarioPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
    expect(listPostsForUserMock).not.toHaveBeenCalled();
  });

  it("mostra o estado vazio quando o usuário não tem posts", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listPostsForUserMock.mockResolvedValue([]);

    const jsx = await CalendarioPage();
    render(jsx);

    expect(screen.getByText("Nenhuma publicação ainda.")).toBeInTheDocument();
  });

  it("lista os posts retornados pelo serviço", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listPostsForUserMock.mockResolvedValue([
      {
        id: "post-1",
        postType: "image",
        status: "SCHEDULED",
        caption: "Legenda agendada",
        scheduledAtUtc: "2026-12-01T10:00:00.000Z",
        publishedAt: null,
        createdAt: "2026-09-20T10:00:00.000Z",
        lastErrorSanitized: null,
        igUsername: "alilu.tec",
        mediaStorageUrl: null,
        itemCount: 1,
      },
    ]);

    const jsx = await CalendarioPage();
    render(jsx);

    expect(screen.getByText("Legenda agendada")).toBeInTheDocument();
    expect(screen.getByText("Agendado")).toBeInTheDocument();
    expect(listPostsForUserMock).toHaveBeenCalledWith("user-1");
  });

  it("mostra os links para criar um post único e um carrossel", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listPostsForUserMock.mockResolvedValue([]);

    const jsx = await CalendarioPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Novo post" })).toHaveAttribute(
      "href",
      "/instagram/painel/calendario/novo",
    );
    expect(screen.getByRole("link", { name: "Novo carrossel" })).toHaveAttribute(
      "href",
      "/instagram/painel/calendario/novo-carrossel",
    );
  });

  it("um post de carrossel mostra o indicativo de quantidade de fotos", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listPostsForUserMock.mockResolvedValue([
      {
        id: "post-1",
        postType: "carousel",
        status: "DRAFT",
        caption: "Legenda do carrossel",
        scheduledAtUtc: null,
        publishedAt: null,
        createdAt: "2026-09-20T10:00:00.000Z",
        lastErrorSanitized: null,
        igUsername: "alilu.tec",
        mediaStorageUrl: null,
        itemCount: 5,
      },
    ]);

    const jsx = await CalendarioPage();
    render(jsx);

    expect(screen.getByText("Carrossel · 5 fotos")).toBeInTheDocument();
  });
});
