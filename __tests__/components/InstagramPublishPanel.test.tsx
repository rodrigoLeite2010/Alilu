import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { PostFormat } from "@/lib/instagram/formats";

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  uploadPresigned: (...args: unknown[]) => uploadPresignedMock(...args),
}));

const canvasToBlobMock = vi.fn();
const waitForFontsMock = vi.fn();
vi.mock("@/lib/instagram/export", () => ({
  canvasToBlob: (...args: unknown[]) => canvasToBlobMock(...args),
  waitForFonts: (...args: unknown[]) => waitForFontsMock(...args),
}));

const { PublishPanel } = await import("@/components/instagram/PublishPanel");

const format: PostFormat = {
  id: "quadrado",
  label: "Post quadrado (1080 × 1080)",
  shortLabel: "Quadrado",
  width: 1080,
  height: 1080,
  description: "Proporção 1:1 — ideal para o feed do Instagram.",
};

function fakeCanvasRef() {
  return { current: {} as unknown as HTMLCanvasElement };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("PublishPanel", () => {
  it("renderiza os campos de legenda e agendamento e o botão de publicar", () => {
    render(<PublishPanel canvasRef={fakeCanvasRef()} format={format} userId="user-1" />);

    expect(screen.getByLabelText("Legenda")).toBeInTheDocument();
    expect(screen.getByLabelText("Agendar para (opcional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });

  it('mostra um erro e não faz upload se "Agendar" é clicado sem escolher uma data', async () => {
    render(<PublishPanel canvasRef={fakeCanvasRef()} format={format} userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/escolha uma data/i);
    expect(canvasToBlobMock).not.toHaveBeenCalled();
  });

  it('"Publicar agora": gera o JPEG, sobe pro Blob, cria o post e publica — mostra sucesso', async () => {
    waitForFontsMock.mockResolvedValue(undefined);
    canvasToBlobMock.mockResolvedValue(new Blob(["fake"], { type: "image/jpeg" }));
    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/instagram-media/user-1/alilu-instagram-post.jpg" });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/instagram/posts") {
        return Promise.resolve(new Response(JSON.stringify({ postId: "post-1" }), { status: 201 }));
      }
      if (url === "/api/instagram/posts/post-1/publish") {
        return Promise.resolve(new Response(JSON.stringify({ status: "PUBLISHED" }), { status: 200 }));
      }
      throw new Error(`fetch inesperado: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublishPanel canvasRef={fakeCanvasRef()} format={format} userId="user-1" />);

    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Minha legenda" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Publicado com sucesso"));

    expect(canvasToBlobMock).toHaveBeenCalledWith(expect.anything(), "image/jpeg", 0.92);
    expect(uploadPresignedMock).toHaveBeenCalledWith(
      "instagram-media/user-1/alilu-instagram-post.jpg",
      expect.any(Blob),
      expect.objectContaining({ access: "public", handleUploadUrl: "/api/instagram/media/upload" }),
    );

    const createCall = fetchMock.mock.calls.find(([url]) => url === "/api/instagram/posts");
    expect(createCall).toBeTruthy();
    const createBody = JSON.parse((createCall![1] as RequestInit).body as string);
    expect(createBody).toEqual({
      mediaUrl: "https://blob.example.com/instagram-media/user-1/alilu-instagram-post.jpg",
      caption: "Minha legenda",
      scheduledAt: null,
    });
  });

  it('"Agendar" com uma data futura cria o post SCHEDULED sem chamar a rota de publicar', async () => {
    waitForFontsMock.mockResolvedValue(undefined);
    canvasToBlobMock.mockResolvedValue(new Blob(["fake"], { type: "image/jpeg" }));
    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/img.jpg" });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/instagram/posts") {
        return Promise.resolve(new Response(JSON.stringify({ postId: "post-1" }), { status: 201 }));
      }
      throw new Error(`fetch inesperado: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const futureLocal = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    render(<PublishPanel canvasRef={fakeCanvasRef()} format={format} userId="user-1" />);
    fireEvent.change(screen.getByLabelText("Agendar para (opcional)"), { target: { value: futureLocal } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Post agendado"));

    expect(fetchMock).toHaveBeenCalledTimes(1); // só criou o post, nunca chamou /publish
  });

  it("mostra a mensagem de erro do servidor quando a criação do post falha", async () => {
    waitForFontsMock.mockResolvedValue(undefined);
    canvasToBlobMock.mockResolvedValue(new Blob(["fake"], { type: "image/jpeg" }));
    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/img.jpg" });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "Nenhuma conta conectada." }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<PublishPanel canvasRef={fakeCanvasRef()} format={format} userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhuma conta conectada.");
  });
});
