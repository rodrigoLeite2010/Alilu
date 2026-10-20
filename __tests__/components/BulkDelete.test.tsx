import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PublicationsManager } from "@/components/instagram/PublicationsManager";
import type { CalendarPostCardData } from "@/components/instagram/CalendarPostCard";

function post(id: string, overrides: Partial<CalendarPostCardData> = {}): CalendarPostCardData {
  return {
    id,
    postType: "image",
    status: "DRAFT",
    caption: `Legenda ${id}`,
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

const POSTS = [
  post("p1"),
  post("p2"),
  post("p3", { status: "SCHEDULED", scheduledAtUtc: "2030-01-01T12:00:00.000Z" }),
  post("p4", { status: "PROCESSING" }),
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Botão "Fechar" do rodapé do diálogo (o "✕" do cabeçalho tem o mesmo nome acessível). */
function closeDialog(): HTMLElement {
  return within(screen.getByRole("dialog")).getAllByRole("button", { name: "Fechar" }).at(-1)!;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Exclusão em massa — Minhas publicações", () => {
  it("botão desabilitado sem seleção; contador e rótulo seguem a seleção; desmarcar zera", () => {
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);
    const button = screen.getByRole("button", { name: /Excluir selecionados/ });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /Legenda p1/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Legenda p2/ }));
    expect(screen.getByRole("status", { name: "" })).toBeDefined();
    expect(screen.getByText("2 itens selecionados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir selecionados (2)" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Desmarcar todos" }));
    expect(screen.getByRole("button", { name: /Excluir selecionados/ })).toBeDisabled();
  });

  it("Selecionar todos ignora publicações em processamento (não podem ser excluídas)", () => {
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);
    expect(screen.getByRole("checkbox", { name: /Legenda p4/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    expect(screen.getByText("3 itens selecionados")).toBeInTheDocument();
  });

  it("mudar de filtro descarta da seleção o que saiu da tela", () => {
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    fireEvent.click(screen.getByRole("tab", { name: /Rascunhos/ }));
    expect(screen.getByText("2 itens selecionados")).toBeInTheDocument();
  });

  it("confirma, mostra o resultado e remove da lista só o que foi excluído (falha parcial)", async () => {
    const fetchMock = vi.fn(async () => json({ deleted: ["p1"], failed: [{ id: "p2", reason: "Está em processamento no Instagram agora." }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Legenda p1/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Legenda p2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir selecionados (2)" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Tem certeza que deseja excluir os 2 itens selecionados\? Esta ação poderá ser irreversível\./)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: /Excluir 2 itens/ }));

    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText(/1 item excluído\. 1 item não pôde ser excluído\./)).toBeInTheDocument());
    expect(within(screen.getByRole("dialog")).getByText(/processamento/)).toBeInTheDocument();
    // Uma única requisição para o lote, com os dois ids.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/instagram/posts/bulk-delete");
    expect(JSON.parse(init.body as string)).toEqual({ ids: ["p1", "p2"] });

    fireEvent.click(closeDialog());
    expect(screen.queryByRole("checkbox", { name: /Legenda p1/ })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Legenda p2/ })).toBeInTheDocument();
  });

  it("sucesso total mostra a mensagem final com a quantidade", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ deleted: ["p1", "p2", "p3"], failed: [] })));
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir selecionados (3)" }));
    fireEvent.click(await screen.findByRole("button", { name: /Excluir 3 itens/ }));
    await waitFor(() => expect(screen.getAllByText("3 itens excluídos com sucesso.").length).toBeGreaterThan(0));
  });

  it("cancelar na confirmação não chama o servidor", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Legenda p1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir selecionados (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede: informa a falha e mantém os itens na lista", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<PublicationsManager initialPosts={POSTS} userId="u1" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Legenda p1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir selecionados (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: /Excluir 1 item/ }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText(/Nenhum item foi excluído/)).toBeInTheDocument());
    expect(within(screen.getByRole("dialog")).getByText(/Falha de conexão/)).toBeInTheDocument();
    fireEvent.click(closeDialog());
    expect(screen.getByRole("checkbox", { name: /Legenda p1/ })).toBeInTheDocument();
  });
});
