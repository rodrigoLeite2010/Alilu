import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MAX_OUTPUT_DURATION_SECONDS } from "@/lib/videos/config";

/**
 * Testes de interface do editor de vídeo split-screen: upload dos dois
 * vídeos (mock), troca de formato/layout, botão "Trocar vídeos", preset
 * "Vídeo satisfatório", validação de corte inválido mostrando erro
 * amigável, estado de duração excedendo o limite desabilitando "Gerar
 * vídeo", e o fluxo completo mockando a chamada de upload ao Blob e a
 * rota /api/videos/split-screen — mesmo espírito de mock de
 * __tests__/components/DiaDeSorteGenerator.test.tsx (fetch) e de
 * __tests__/components/InstagramPublicationComposerPanel.test.tsx
 * (uploadPresigned).
 */

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  uploadPresigned: (...args: unknown[]) => uploadPresignedMock(...args),
}));

const { VideoSplitScreenEditor } = await import("@/components/videos/VideoSplitScreenEditor");

function makeVideoFile(name: string, type = "video/mp4"): File {
  return new File([new Uint8Array(10)], name, { type });
}

function setVideoDuration(videoEl: HTMLVideoElement, seconds: number) {
  Object.defineProperty(videoEl, "duration", { configurable: true, value: seconds });
  Object.defineProperty(videoEl, "videoWidth", { configurable: true, value: 1920 });
  Object.defineProperty(videoEl, "videoHeight", { configurable: true, value: 1080 });
}

async function selectFile(label: string, previewTestId: string, file: File, durationSeconds: number) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  const videoEl = (await screen.findByTestId(previewTestId)) as HTMLVideoElement;
  setVideoDuration(videoEl, durationSeconds);
  fireEvent.loadedMetadata(videoEl);
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  uploadPresignedMock.mockReset();
  uploadPresignedMock.mockImplementation(async (pathname: string) => ({ url: `https://blob.example.com/${pathname}` }));
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ url: "https://blob.example.com/videos/outputs/resultado.mp4" }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("VideoSplitScreenEditor — upload dos dois vídeos", () => {
  it("aceita os dois vídeos e mostra o nome do arquivo e a duração de cada um", async () => {
    render(<VideoSplitScreenEditor />);

    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 10);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("complementar.mp4"), 4);

    const primarySlot = screen.getByTestId("video-slot-primary");
    const secondarySlot = screen.getByTestId("video-slot-secondary");
    expect(within(primarySlot).getByText(/principal\.mp4/)).toBeInTheDocument();
    expect(within(primarySlot).getByText(/Duração do arquivo enviado: 00:10/)).toBeInTheDocument();
    expect(within(secondarySlot).getByText(/complementar\.mp4/)).toBeInTheDocument();
    expect(within(secondarySlot).getByText(/Duração do arquivo enviado: 00:04/)).toBeInTheDocument();
  });

  it("rejeita um arquivo de formato não suportado, com mensagem amigável, e nunca cria o preview", () => {
    render(<VideoSplitScreenEditor />);

    const input = screen.getByLabelText("Vídeo principal (fica em cima)") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeVideoFile("nota.txt", "text/plain")] } });

    expect(screen.queryByTestId("preview-video-primary")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Formato não suportado. Envie um vídeo MP4, MOV ou WEBM.");
  });
});

describe("VideoSplitScreenEditor — formato e layout", () => {
  it("permite trocar o formato de saída e a proporção do split", () => {
    render(<VideoSplitScreenEditor />);

    expect(screen.getByRole("button", { name: "Vertical (9:16)" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Quadrado (1:1)" }));
    expect(screen.getByRole("button", { name: "Quadrado (1:1)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Vertical (9:16)" })).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByRole("button", { name: "50 / 50" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "60 / 40" }));
    expect(screen.getByRole("button", { name: "60 / 40" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("VideoSplitScreenEditor — Trocar vídeos", () => {
  it('o botão "Trocar vídeos" inverte os arquivos (e seus cortes) entre principal e complementar', async () => {
    render(<VideoSplitScreenEditor />);

    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("um.mp4"), 10);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("dois.mp4"), 4);

    fireEvent.click(screen.getByRole("button", { name: /trocar vídeos/i }));

    const primarySlot = screen.getByTestId("video-slot-primary");
    const secondarySlot = screen.getByTestId("video-slot-secondary");
    expect(within(primarySlot).getByText(/dois\.mp4/)).toBeInTheDocument();
    expect(within(secondarySlot).getByText(/um\.mp4/)).toBeInTheDocument();
  });
});

describe("VideoSplitScreenEditor — preset Vídeo satisfatório", () => {
  it("reafirma formato vertical, split 50/50, loop e áudio do principal, mesmo partindo de outras escolhas", () => {
    render(<VideoSplitScreenEditor />);

    fireEvent.click(screen.getByRole("button", { name: "Quadrado (1:1)" }));
    fireEvent.click(screen.getByRole("button", { name: "60 / 40" }));
    fireEvent.click(screen.getByRole("button", { name: "Vídeo complementar" }));
    fireEvent.click(screen.getByRole("radio", { name: /Cortar no mais curto/ }));

    fireEvent.click(screen.getByRole("button", { name: /preset: vídeo satisfatório/i }));

    expect(screen.getByRole("button", { name: "Vertical (9:16)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "50 / 50" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Vídeo principal" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("radio", { name: /Repetir em loop/ })).toBeChecked();
  });
});

describe("VideoSplitScreenEditor — validação de corte", () => {
  it("mostra um erro amigável quando o fim do corte não é depois do início", async () => {
    render(<VideoSplitScreenEditor />);
    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 10);

    const primarySlot = screen.getByTestId("video-slot-primary");
    fireEvent.change(within(primarySlot).getByLabelText("Início (mm:ss)"), { target: { value: "00:05" } });
    fireEvent.change(within(primarySlot).getByLabelText("Fim (mm:ss)"), { target: { value: "00:02" } });

    expect(await within(primarySlot).findByRole("alert")).toHaveTextContent(
      "O fim do corte precisa ser depois do início.",
    );
    expect(screen.getByTestId("generate-button")).toBeDisabled();
  });
});

describe("VideoSplitScreenEditor — limite de duração do resultado", () => {
  it('desabilita "Gerar vídeo" quando a duração final estimada passa do limite da ferramenta', async () => {
    render(<VideoSplitScreenEditor />);

    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 300);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("complementar.mp4"), 300);

    const primarySlot = screen.getByTestId("video-slot-primary");
    fireEvent.change(within(primarySlot).getByLabelText("Fim (mm:ss)"), {
      target: { value: "04:00" }, // 240s > MAX_OUTPUT_DURATION_SECONDS (150s), modo padrão = loop
    });

    expect(await screen.findByText(new RegExp(`acima do limite de ${MAX_OUTPUT_DURATION_SECONDS}s`))).toBeInTheDocument();
    expect(screen.getByTestId("generate-button")).toBeDisabled();
  });
});

describe("VideoSplitScreenEditor — fluxo completo de geração", () => {
  it("envia os dois vídeos ao Blob, chama a rota de processamento e mostra o resultado para baixar", async () => {
    render(<VideoSplitScreenEditor />);

    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 10);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("complementar.mp4"), 4);

    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => expect(uploadPresignedMock).toHaveBeenCalledTimes(2));
    expect(uploadPresignedMock.mock.calls[0][0]).toMatch(/^videos\/uploads\//);
    expect(uploadPresignedMock.mock.calls[0][2]).toMatchObject({ handleUploadUrl: "/api/videos/upload" });

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/videos/split-screen", expect.anything()));
    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      outputFormat: "vertical",
      layoutRatio: "50-50",
      primaryFraming: { positionX: 0, positionY: 0, zoom: 1 },
      secondaryFraming: { positionX: 0, positionY: 0, zoom: 1 },
      durationMode: "loop",
      audio: { source: "primary" },
    });
    expect(body.primaryBlobUrl).toMatch(/^https:\/\/blob\.example\.com\//);
    expect(body.secondaryBlobUrl).toMatch(/^https:\/\/blob\.example\.com\//);

    const resultVideo = await screen.findByTestId("result-video");
    expect(resultVideo).toHaveAttribute("src", "https://blob.example.com/videos/outputs/resultado.mp4");
    const downloadLink = screen.getByRole("link", { name: /baixar vídeo/i });
    expect(downloadLink).toHaveAttribute("href", "https://blob.example.com/videos/outputs/resultado.mp4");
    expect(downloadLink).toHaveAttribute("download");
  });

  it("envia o zoom do vídeo selecionado para a rota de processamento", async () => {
    render(<VideoSplitScreenEditor />);

    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 10);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("complementar.mp4"), 4);

    fireEvent.change(screen.getByLabelText("Zoom do enquadramento"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByTestId("generate-button"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/videos/split-screen", expect.anything()));
    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body.primaryFraming).toEqual({ positionX: 0, positionY: 0, zoom: 1.5 });
    expect(body.secondaryFraming).toEqual({ positionX: 0, positionY: 0, zoom: 1 });
  });

  it('mostra uma mensagem de erro quando a rota de processamento falha, sem quebrar a interface', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Não foi possível gerar o vídeo." }),
    }) as unknown as typeof fetch;

    render(<VideoSplitScreenEditor />);
    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 10);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("complementar.mp4"), 4);

    fireEvent.click(screen.getByTestId("generate-button"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível gerar o vídeo.");
  });
});

describe("VideoSplitScreenEditor — indicador de progresso (3 estados textuais)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passa por "Enviando vídeos...", depois "Processando..." e, após aguardar o suficiente, "Finalizando..." — sem porcentagem real', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as unknown as typeof fetch;

    render(<VideoSplitScreenEditor />);
    await selectFile("Vídeo principal (fica em cima)", "preview-video-primary", makeVideoFile("principal.mp4"), 10);
    await selectFile("Vídeo complementar (fica embaixo)", "preview-video-secondary", makeVideoFile("complementar.mp4"), 4);

    vi.useFakeTimers();

    fireEvent.click(screen.getByTestId("generate-button"));
    expect(screen.getByTestId("generate-button")).toHaveTextContent("Enviando vídeos...");

    // Deixa a promise mockada de uploadPresigned resolver (não depende de
    // timer nenhum — só de microtasks, que os fake timers não congelam).
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
      }
    });
    expect(screen.getByTestId("generate-button")).toHaveTextContent("Processando...");

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId("generate-button")).toHaveTextContent("Finalizando...");

    // Libera a promise pendente do fetch para a função de geração não
    // ficar presa depois que o teste termina.
    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ url: "https://blob.example.com/videos/outputs/resultado.mp4" }) });
      await Promise.resolve();
    });
  });
});
