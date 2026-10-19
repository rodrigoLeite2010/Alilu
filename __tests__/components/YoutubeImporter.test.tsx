import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { YoutubeImportDto } from "@/lib/youtube-import/types";

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({ uploadPresigned: (...a: unknown[]) => uploadPresignedMock(...a) }));
vi.mock("@/lib/client/upload-telemetry", () => ({ trackUpload: vi.fn(), markPickerOpen: vi.fn(), clearPickerMark: vi.fn() }));
vi.mock("@/lib/client/file-readability", () => ({
  ensureReadableFile: async (file: File) => file,
  readFailureReason: () => "x",
  FileNotReadableError: class extends Error {},
}));

const { YoutubeImporter } = await import("@/components/youtube-import/YoutubeImporter");

const ID = "dQw4w9WgXcQ";
const IMPORT_ID = "6f1c2b9e-1111-4222-8333-944455556666";

function dto(overrides: Partial<YoutubeImportDto> = {}): YoutubeImportDto {
  return {
    id: IMPORT_ID,
    status: "ANALYZED",
    videoId: ID,
    kind: "video",
    normalizedUrl: `https://www.youtube.com/watch?v=${ID}`,
    availability: "AVAILABLE",
    metadataSource: "data_api",
    title: "Meu vídeo",
    channelTitle: "Canal da Alilu",
    thumbnailUrl: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    youtubeDurationSeconds: 253,
    embeddable: true,
    madeForKids: false,
    regionRestricted: false,
    warningMessage: null,
    fileUrl: null,
    contentType: null,
    fileSizeBytes: null,
    durationSeconds: null,
    width: null,
    height: null,
    hasAudio: null,
    durationMismatch: false,
    createdAt: "2026-10-18T15:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;

function setup() {
  render(<YoutubeImporter userId="user-1" maxUploadMb={100} maxDurationMinutes={10} initialQuota={{ used: 1, limit: 50, unlimited: false }} />);
  fireEvent.change(screen.getByLabelText(/Cole o link/), { target: { value: `https://youtu.be/${ID}` } });
  fireEvent.click(screen.getByRole("checkbox"));
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  uploadPresignedMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("YoutubeImporter", () => {
  it("valida o link no navegador e exige a declaração antes de analisar", () => {
    render(<YoutubeImporter userId="user-1" maxUploadMb={100} maxDurationMinutes={10} />);
    const input = screen.getByLabelText(/Cole o link/);
    fireEvent.change(input, { target: { value: "https://vimeo.com/123" } });
    expect(screen.getByText(/não foi reconhecido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar vídeo" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("analisa e mostra miniatura, título, canal, duração, disponibilidade e as opções permitidas", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { import: dto(), duplicate: null, quota: { used: 2, limit: 50, unlimited: false } }));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    expect(await screen.findByTestId("youtube-title")).toHaveTextContent("Meu vídeo");
    expect(screen.getByText("Canal da Alilu")).toBeInTheDocument();
    expect(screen.getByText("04:13")).toBeInTheDocument();
    expect(screen.getByText("Disponível publicamente")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    expect(screen.getByText(/os termos do YouTube não permitem/)).toBeInTheDocument();
    expect(screen.getByText("2 de 50 consultas usadas hoje")).toBeInTheDocument();
    // Nada de "importado" antes de existir arquivo.
    expect(screen.queryByText(/pronto para edição/)).not.toBeInTheDocument();
    // Player oficial só depois do clique, em youtube-nocookie.
    fireEvent.click(screen.getByRole("button", { name: /Ver prévia/ }));
    expect(screen.getByTestId("youtube-embed")).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${ID}?rel=0&modestbranding=1`);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/videos/youtube-import/analyze");
    expect(JSON.parse(init.body)).toEqual({ url: `https://youtu.be/${ID}`, authorized: true, force: false });
  });

  it("vídeo privado: sem player, com orientação para enviar o original", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { import: dto({ availability: "PRIVATE", title: null, embeddable: false, thumbnailUrl: null }), duplicate: null }));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    expect(await screen.findByText("Privado, restrito ou sem incorporação permitida")).toBeInTheDocument();
    expect(screen.getAllByText(/YouTube Studio/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Ver prévia/ })).not.toBeInTheDocument();
  });

  it.each([
    [429, { error: "Muitas consultas em pouco tempo.", code: "RATE_LIMITED" }, "Muitas consultas em pouco tempo."],
    [400, { error: "Esse link do YouTube não foi reconhecido.", code: "INVALID_URL" }, "Esse link do YouTube não foi reconhecido."],
    [401, { error: "x", code: "UNAUTHENTICATED" }, "Sua sessão expirou. Entre de novo na sua conta."],
  ])("erro %s da API interna aparece de forma clara", async (status, body, message) => {
    fetchMock.mockResolvedValueOnce(json(status, body));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("erro de conexão", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/conexão/);
  });

  it("cota da API esgotada: mostra aviso e ainda deixa enviar o original", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { import: dto({ availability: "UNKNOWN", metadataSource: "none", title: null, warningMessage: "A cota diária da API do YouTube da Alilu acabou." }), duplicate: null }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    expect(await screen.findByTestId("youtube-warning")).toHaveTextContent(/cota/);
    expect(screen.getByTestId("youtube-file-input")).not.toBeDisabled();
  });

  async function analyzed() {
    fetchMock.mockResolvedValueOnce(json(200, { import: dto(), duplicate: null }));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    await screen.findByTestId("youtube-analysis");
  }

  it("upload válido: só mostra sucesso depois que o servidor confirma COMPLETED, com as ações do editor", async () => {
    await analyzed();
    uploadPresignedMock.mockResolvedValue({ url: `https://abc.public.blob.vercel-storage.com/videos/imports/user-1/youtube/${IMPORT_ID}/original-x.mp4` });
    fetchMock.mockResolvedValueOnce(
      json(200, {
        import: dto({ status: "COMPLETED", fileUrl: "https://abc.public.blob.vercel-storage.com/f.mp4", contentType: "video/mp4", durationSeconds: 252, width: 1080, height: 1920, hasAudio: true, fileSizeBytes: 5_000_000 }),
      }),
    );
    const file = new File([new Uint8Array(2048)], "meu-video.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByTestId("youtube-file-input"), { target: { files: [file] } });
    const done = await screen.findByTestId("youtube-import-done");
    expect(done).toHaveTextContent("pronto para edição");
    expect(uploadPresignedMock.mock.calls[0][0]).toBe(`videos/imports/user-1/youtube/${IMPORT_ID}/original.mp4`);
    expect(uploadPresignedMock.mock.calls[0][2]).toMatchObject({ handleUploadUrl: "/api/videos/youtube-import/upload", access: "public" });
    expect(within(done).getByRole("link", { name: "Editar no Split-Screen" })).toHaveAttribute("href", `/videos/editor-split-screen?youtube=${IMPORT_ID}`);
    expect(within(done).getByRole("link", { name: "Publicar no Reels" })).toHaveAttribute("href", `/instagram/reels?youtube=${IMPORT_ID}`);
    expect(screen.getByTestId("youtube-history")).toHaveTextContent("Meu vídeo");
  });

  it("upload recusado pelo servidor (arquivo inválido): erro e nenhum sucesso", async () => {
    await analyzed();
    uploadPresignedMock.mockResolvedValue({ url: "https://abc.public.blob.vercel-storage.com/x.mp4" });
    fetchMock.mockResolvedValueOnce(json(422, { error: "O arquivo não tem uma trilha de vídeo válida.", code: "INVALID_FILE" }));
    fireEvent.change(screen.getByTestId("youtube-file-input"), { target: { files: [new File([new Uint8Array(10)], "a.mp4", { type: "video/mp4" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("trilha de vídeo");
    expect(screen.queryByTestId("youtube-import-done")).not.toBeInTheDocument();
  });

  it("falha no upload para o storage: mensagem clara", async () => {
    await analyzed();
    uploadPresignedMock.mockRejectedValue(new Error("network"));
    fireEvent.change(screen.getByTestId("youtube-file-input"), { target: { files: [new File([new Uint8Array(10)], "a.mp4", { type: "video/mp4" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível enviar o arquivo/);
  });

  it("arquivo incompatível e arquivo grande demais são barrados antes de enviar", async () => {
    await analyzed();
    fireEvent.change(screen.getByTestId("youtube-file-input"), { target: { files: [new File(["x"], "foto.png", { type: "image/png" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Formato não suportado/);
    const big = new File(["x"], "grande.mp4", { type: "video/mp4" });
    Object.defineProperty(big, "size", { value: 101 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId("youtube-file-input"), { target: { files: [big] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/grande demais/));
    expect(uploadPresignedMock).not.toHaveBeenCalled();
  });

  it("vídeo já enviado antes: oferece abrir o existente", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { import: null, duplicate: dto({ status: "COMPLETED", fileUrl: "https://abc.public.blob.vercel-storage.com/f.mp4" }) }));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Analisar vídeo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Abrir existente" }));
    expect(screen.getByTestId("youtube-import-done")).toBeInTheDocument();
  });

  it("celular (375px): campos e botões com área de toque e botão principal em largura total", () => {
    window.innerWidth = 375;
    window.dispatchEvent(new Event("resize"));
    render(<YoutubeImporter userId="user-1" maxUploadMb={100} maxDurationMinutes={10} />);
    expect(screen.getByLabelText(/Cole o link/).className).toMatch(/min-h-11/);
    expect(screen.getByLabelText(/Cole o link/).className).toMatch(/w-full/);
    expect(screen.getByRole("button", { name: "Analisar vídeo" }).className).toMatch(/w-full/);
  });
});
