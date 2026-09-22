import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { CalendarPostCard, type CalendarPostCardData } from "@/components/instagram/CalendarPostCard";

function post(overrides: Partial<CalendarPostCardData> = {}): CalendarPostCardData {
  return {
    id: "post-1",
    postType: "image",
    status: "DRAFT",
    caption: "Legenda de teste",
    scheduledAtUtc: null,
    publishedAt: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    lastErrorSanitized: null,
    igUsername: "alilu.tec",
    mediaStorageUrl: null,
    itemCount: 1,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CalendarPostCard", () => {
  it("mostra o status, a legenda, e os botões de publicar/cancelar para um DRAFT", () => {
    render(<CalendarPostCard post={post()} />);

    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Legenda de teste")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("post de carrossel mostra o indicativo \"Carrossel · N fotos\"; imagem única não mostra nada disso", () => {
    render(<CalendarPostCard post={post({ postType: "carousel", itemCount: 4 })} />);
    expect(screen.getByText("Carrossel · 4 fotos")).toBeInTheDocument();
  });

  it("post de imagem única não mostra o indicativo de carrossel", () => {
    render(<CalendarPostCard post={post({ postType: "image" })} />);
    expect(screen.queryByText(/carrossel/i)).not.toBeInTheDocument();
  });

  it("um post PUBLISHED não mostra nem publicar nem cancelar", () => {
    render(<CalendarPostCard post={post({ status: "PUBLISHED", publishedAt: "2026-09-21T10:00:00.000Z" })} />);

    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar agora" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("cancelar chama a rota PATCH e atualiza o status exibido para Cancelado", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "CANCELLED" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarPostCard post={post()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.getByText("Cancelado")).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/instagram/posts/post-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ action: "cancel" });
  });

  it("não chama a rota quando o usuário não confirma o cancelamento", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarPostCard post={post()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("publicar agora chama a rota de publish e atualiza o status para o retornado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "PROCESSING" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarPostCard post={post({ status: "SCHEDULED" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByText("Publicando…")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/instagram/posts/post-1/publish", { method: "POST" });
  });

  it("mostra a mensagem de erro quando a ação falha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "Post não encontrado." }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarPostCard post={post({ status: "SCHEDULED" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Post não encontrado.");
  });

  it("um post FAILED mostra a mensagem de erro sanitizada", () => {
    render(
      <CalendarPostCard
        post={post({ status: "FAILED", lastErrorSanitized: "Falha ao criar o container de mídia." })}
      />,
    );

    expect(screen.getByText("Falha ao criar o container de mídia.")).toBeInTheDocument();
  });
});
