import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  it("DRAFT: mostra status, legenda e as ações Editar, Agendar, Publicar agora e Excluir", () => {
    render(<CalendarPostCard post={post()} userId="user-1" />);

    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Legenda de teste")).toBeInTheDocument();
    expect(screen.getByText("@alilu.tec")).toBeInTheDocument();
    for (const name of ["Editar", "Agendar", "Publicar agora", "Excluir"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("SCHEDULED: Editar, Alterar horário, Cancelar agendamento e Excluir, com data no fuso do agendamento", () => {
    render(
      <CalendarPostCard
        post={post({ status: "SCHEDULED", scheduledAtUtc: "2026-09-24T21:30:00.000Z", timezone: "America/Sao_Paulo" })}
        userId="user-1"
      />,
    );
    expect(screen.getByText("Agendado para 24/09/2026, 18:30")).toBeInTheDocument();
    for (const name of ["Editar", "Alterar horário", "Cancelar agendamento", "Excluir"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("PUBLISHED: Excluir do Alilu avisa que continua no Instagram", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "DELETED" })));
    vi.stubGlobal("fetch", fetchMock);
    const onRemove = vi.fn();
    render(
      <CalendarPostCard
        post={post({ status: "PUBLISHED", publishedAt: "2026-09-21T10:00:00.000Z", mediaStorageUrl: "https://blob/x.jpg" })}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByRole("link", { name: "Visualizar" })).toHaveAttribute("href", "https://blob/x.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Excluir do Alilu" }));

    const dialog = await screen.findByRole("dialog", { name: "Excluir esta publicação do histórico do Alilu?" });
    expect(dialog).toHaveTextContent("A publicação continuará disponível no Instagram.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir do Alilu" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("post-1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/instagram/posts/post-1", { method: "DELETE" });
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
    expect(screen.queryByRole("button", { name: "Cancelar agendamento" })).not.toBeInTheDocument();
  });

  it("cancelar agendamento pede confirmação, chama a rota PATCH e mostra Cancelado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "CANCELLED" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarPostCard post={post({ status: "SCHEDULED", scheduledAtUtc: "2099-01-01T10:00:00.000Z" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar agendamento" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar agendamento" }));

    await waitFor(() => expect(screen.getByText("Cancelado")).toBeInTheDocument());
    expect(screen.getByText("Agendamento cancelado.")).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ action: "cancel" });
  });

  it("não chama a rota quando o usuário volta sem confirmar o cancelamento", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CalendarPostCard post={post({ status: "SCHEDULED", scheduledAtUtc: "2099-01-01T10:00:00.000Z" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar agendamento" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Voltar" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alterar horário envia o novo instante com o fuso do navegador", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "SCHEDULED" })));
    vi.stubGlobal("fetch", fetchMock);
    render(<CalendarPostCard post={post({ status: "SCHEDULED", scheduledAtUtc: "2099-01-01T10:00:00.000Z" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Alterar horário" }));
    const dialog = await screen.findByRole("dialog", { name: "Alterar horário" });
    fireEvent.change(within(dialog).getByLabelText("Data"), { target: { value: "2099-02-03" } });
    fireEvent.change(within(dialog).getByLabelText("Hora"), { target: { value: "09:15" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(/Publicação agendada com sucesso\. Seu post será publicado em 03\/02 às 09:15\./)).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ action: "reschedule", timezone: expect.any(String) });
    expect(body.scheduledAt).toMatch(/Z$/);
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

  it("FAILED: Ver erro mostra a mensagem sanitizada e há Tentar novamente", async () => {
    render(
      <CalendarPostCard
        post={post({ status: "FAILED", lastErrorSanitized: "Falha ao criar o container de mídia." })}
        userId="user-1"
      />,
    );

    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver erro" }));
    expect(await screen.findByText("Falha ao criar o container de mídia.")).toBeInTheDocument();
  });
});
