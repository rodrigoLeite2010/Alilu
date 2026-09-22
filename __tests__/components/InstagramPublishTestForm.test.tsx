import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  uploadPresigned: (...args: unknown[]) => uploadPresignedMock(...args),
}));

const { InstagramPublishTestForm } = await import("@/components/instagram/PublishTestForm");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function selectFile(input: HTMLElement, file: File): void {
  fireEvent.change(input, { target: { files: [file] } });
}

describe("InstagramPublishTestForm", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    uploadPresignedMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("mostra o aviso de que a publicação é real", () => {
    render(<InstagramPublishTestForm />);
    expect(screen.getByText(/publica de verdade/i)).toBeInTheDocument();
  });

  it("o botão fica desabilitado até um arquivo ser escolhido", () => {
    render(<InstagramPublishTestForm />);
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeDisabled();
  });

  it("faz upload, cria o post e publica com sucesso (status PUBLISHED)", async () => {
    render(<InstagramPublishTestForm />);

    const file = new File(["conteudo"], "foto.jpg", { type: "image/jpeg" });
    selectFile(screen.getByLabelText("Imagem"), file);
    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Minha legenda" } });

    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/foto-123.jpg" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { postId: "post-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "PUBLISHED" }));

    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Publicado com sucesso"));

    expect(uploadPresignedMock).toHaveBeenCalledWith(
      "foto.jpg",
      file,
      expect.objectContaining({ access: "public", handleUploadUrl: "/api/instagram/media/upload" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/instagram/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mediaUrl: "https://blob.example.com/foto-123.jpg", caption: "Minha legenda" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/instagram/posts/post-1/publish", { method: "POST" });
  });

  it("mostra uma mensagem de 'ainda processando' quando o status vem PROCESSING (não é um erro)", async () => {
    render(<InstagramPublishTestForm />);

    const file = new File(["conteudo"], "foto.jpg", { type: "image/jpeg" });
    selectFile(screen.getByLabelText("Imagem"), file);

    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/foto-123.jpg" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(201, { postId: "post-1" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "PROCESSING" }));

    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ainda está processando"));
  });

  it("mostra a mensagem de erro devolvida pela API de criação do post", async () => {
    render(<InstagramPublishTestForm />);

    const file = new File(["conteudo"], "foto.jpg", { type: "image/jpeg" });
    selectFile(screen.getByLabelText("Imagem"), file);

    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/foto-123.jpg" });
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: "Mídia não encontrada." }));

    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Mídia não encontrada."));
    expect(fetchMock).toHaveBeenCalledTimes(1); // nunca chama a rota de publicar se a criação falhou
  });

  it("mostra a mensagem de erro quando o upload em si falha", async () => {
    render(<InstagramPublishTestForm />);

    const file = new File(["conteudo"], "foto.jpg", { type: "image/jpeg" });
    selectFile(screen.getByLabelText("Imagem"), file);

    uploadPresignedMock.mockRejectedValue(new Error("Falha no upload do Blob."));

    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Falha no upload do Blob."));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
