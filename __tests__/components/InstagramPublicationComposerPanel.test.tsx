import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PostFormat } from "@/lib/instagram/formats";
import { createInitialEditorState, setBackgroundImage } from "@/lib/instagram/editor-state";

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  uploadPresigned: (...args: unknown[]) => uploadPresignedMock(...args),
}));
vi.mock("@/lib/instagram/export", () => ({
  canvasToBlob: vi.fn().mockResolvedValue(new Blob(["arte"], { type: "image/jpeg" })),
  waitForFonts: vi.fn().mockResolvedValue(undefined),
}));

const { PublicationComposerPanel } = await import("@/components/instagram/PublicationComposerPanel");

const format: PostFormat = {
  id: "vertical",
  label: "Post vertical (1080 × 1350)",
  shortLabel: "Vertical",
  width: 1080,
  height: 1350,
  description: "",
};
const canvasRef = { current: {} as HTMLCanvasElement };

type Route = (init?: RequestInit) => Response | Promise<Response>;
function mockApi(account: Record<string, unknown>, routes: Record<string, Route> = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/instagram/account") return new Response(JSON.stringify(account));
    const route = routes[url];
    if (route) return route(init);
    throw new Error(`fetch inesperado: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof mockApi>, url: string) {
  const call = fetchMock.mock.calls.find(([called]) => called === url);
  return call ? JSON.parse((call[1] as RequestInit).body as string) : null;
}

let locationHref = "";
beforeEach(() => {
  locationHref = "";
  vi.stubGlobal("location", {
    get href() {
      return locationHref;
    },
    set href(value: string) {
      locationHref = value;
    },
  });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  uploadPresignedMock.mockImplementation(async (pathname: string) => ({ url: `https://blob.example.com/${pathname}` }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const connected = { authenticated: true, connected: true, username: "alilu.tec", userId: "user-1" };

describe("PublicationComposerPanel", () => {
  it("sem login: os botões aparecem, e só ao clicar pede para conectar (login → Meta → volta)", async () => {
    mockApi({ authenticated: false, connected: false, username: null });
    const persist = vi.fn().mockResolvedValue(undefined);
    render(
      <PublicationComposerPanel canvasRef={canvasRef} format={format} state={createInitialEditorState()} source="VIRAL_POST" returnPath="/instagram/posts-virais" onPersistLocalDraft={persist} />,
    );
    await screen.findByText(/Você só conecta sua conta na hora de publicar/);
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Minha legenda" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar publicação" }));

    const gate = await screen.findByRole("dialog", { name: "Conecte seu Instagram para continuar" });
    expect(gate).toHaveTextContent("A criação das artes continua gratuita e sem login.");
    expect(persist).not.toHaveBeenCalled();
    fireEvent.click(within(gate).getByRole("button", { name: "Entrar e conectar Instagram" }));

    await waitFor(() =>
      expect(locationHref).toBe(
        `/entrar?callbackUrl=${encodeURIComponent("/api/instagram/oauth/start?returnTo=%2Finstagram%2Fposts-virais")}`,
      ),
    );
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ caption: "Minha legenda", mode: "schedule" }));
    expect(uploadPresignedMock).not.toHaveBeenCalled();
  });

  it("logado sem Instagram: pede para conectar e volta para a publicação depois", async () => {
    mockApi({ authenticated: true, connected: false, username: null, userId: "user-1" });
    const persist = vi.fn().mockResolvedValue(undefined);
    render(
      <PublicationComposerPanel canvasRef={canvasRef} format={format} state={createInitialEditorState()} source="VIRAL_POST" returnPath="/instagram/posts-virais" onPersistLocalDraft={persist} />,
    );
    await screen.findByText(/Você só conecta sua conta na hora de publicar/);
    fireEvent.click(screen.getByRole("button", { name: "Publicar no Instagram" }));
    const gate = await screen.findByRole("dialog");
    fireEvent.click(within(gate).getByRole("button", { name: "Conectar Instagram" }));
    await waitFor(() =>
      expect(locationHref).toBe("/api/instagram/oauth/start?returnTo=%2Finstagram%2Fposts-virais"),
    );
    expect(persist).toHaveBeenCalled();
  });

  it("prévia + agendar: envia a arte e a foto original ao storage e agenda com fuso", async () => {
    const fetchMock = mockApi(connected, {
      "blob:foto-local": () => new Response("foto", { headers: { "content-type": "image/jpeg" } }),
      "/api/instagram/posts": () => new Response(JSON.stringify({ postId: "post-9" }), { status: 201 }),
    });
    const state = setBackgroundImage(createInitialEditorState("promocao", "vertical"), {
      url: "blob:foto-local",
      fileName: "foto.jpg",
      naturalWidth: 1200,
      naturalHeight: 800,
    });
    const onCompleted = vi.fn();
    render(
      <PublicationComposerPanel canvasRef={canvasRef} format={format} state={state} source="VIRAL_POST" returnPath="/instagram/posts-virais" onCompleted={onCompleted} />,
    );
    await screen.findByText("@alilu.tec");
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Promo 🚀" } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar publicação" }));

    const dialog = await screen.findByRole("dialog", { name: "Prévia da publicação" });
    expect(within(dialog).getByAltText("Prévia da arte que será publicada")).toBeInTheDocument();
    expect(within(dialog).getAllByText("@alilu.tec").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Promo 🚀")).toBeInTheDocument();

    expect(within(dialog).getByLabelText("Agendar")).toBeChecked();
    fireEvent.change(within(dialog).getByLabelText("Data"), { target: { value: "2099-09-24" } });
    fireEvent.change(within(dialog).getByLabelText("Hora"), { target: { value: "18:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(/Publicação agendada com sucesso\. Seu post será publicado em 24\/09 às 18:30\./)).toBeInTheDocument();
    expect(uploadPresignedMock).toHaveBeenCalledTimes(2); // arte final + foto original
    const body = bodyOf(fetchMock, "/api/instagram/posts");
    expect(body).toMatchObject({ postType: "image", caption: "Promo 🚀", source: "VIRAL_POST", templateId: "promocao" });
    expect(new Date(body.scheduledAt).getTime()).toBeGreaterThan(Date.now());
    expect(typeof body.timezone).toBe("string");
    expect(JSON.stringify(body.templateData)).not.toContain("blob:");
    expect(body.templateData.state.backgroundImage.storageUrl).toMatch(/^https:\/\/blob\.example\.com\//);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/publish"))).toBe(false);
    expect(onCompleted).toHaveBeenCalledWith("post-9");
  });

  it("publicar agora: cria e publica, mostrando a mensagem de sucesso", async () => {
    mockApi(connected, {
      "/api/instagram/posts": () => new Response(JSON.stringify({ postId: "post-1" }), { status: 201 }),
      "/api/instagram/posts/post-1/publish": () => new Response(JSON.stringify({ status: "PUBLISHED" })),
    });
    render(<PublicationComposerPanel canvasRef={canvasRef} format={format} state={createInitialEditorState()} source="MANUAL" returnPath="/x" />);
    await screen.findByText("@alilu.tec");
    fireEvent.click(screen.getByRole("button", { name: "Publicar no Instagram" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(/Publicação realizada com sucesso\./)).toBeInTheDocument();
  });

  it("editando uma publicação salva: atualiza em vez de criar outra", async () => {
    const fetchMock = mockApi(connected, {
      "/api/instagram/posts/post-7": () => new Response(JSON.stringify({ status: "DRAFT" })),
    });
    render(
      <PublicationComposerPanel canvasRef={canvasRef} format={format} state={createInitialEditorState()} source="VIRAL_POST" editingPostId="post-7" returnPath="/x" initialValues={{ caption: "antiga" }} />,
    );
    await screen.findByText("@alilu.tec");
    expect(screen.getByLabelText("Legenda")).toHaveValue("antiga");
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho em Minhas publicações" }));
    expect(await screen.findByText(/Rascunho salvo/)).toBeInTheDocument();
    const body = bodyOf(fetchMock, "/api/instagram/posts/post-7");
    expect(body).toMatchObject({ action: "update", caption: "antiga", scheduledAt: null });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/instagram/posts")).toBe(false);
  });

  it("recusa agendamento no passado", async () => {
    mockApi(connected);
    render(<PublicationComposerPanel canvasRef={canvasRef} format={format} state={createInitialEditorState()} source="MANUAL" returnPath="/x" />);
    await screen.findByText("@alilu.tec");
    fireEvent.click(screen.getByRole("button", { name: "Publicar no Instagram" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Agendar"));
    fireEvent.change(within(dialog).getByLabelText("Data"), { target: { value: "2020-01-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/no futuro/);
    expect(uploadPresignedMock).not.toHaveBeenCalled();
  });
});
