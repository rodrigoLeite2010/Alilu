import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import type { CarouselFormatId, CarouselSlide } from "@/lib/instagram/carousel/carousel-state";

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  uploadPresigned: (...args: unknown[]) => uploadPresignedMock(...args),
}));

const waitForFontsMock = vi.fn();
vi.mock("@/lib/instagram/export", () => ({
  waitForFonts: (...args: unknown[]) => waitForFontsMock(...args),
}));

const renderSlideToBlobMock = vi.fn();
vi.mock("@/lib/instagram/carousel/carousel-export", () => ({
  renderSlideToBlob: (...args: unknown[]) => renderSlideToBlobMock(...args),
}));

const { CarouselPublishPanel } = await import("@/components/instagram/CarouselPublishPanel");

const formatId: CarouselFormatId = "quadrado";

function fakeSlides(count: number): CarouselSlide[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `slide-${index}`,
    order: index,
    state: {} as never,
  })) as unknown as CarouselSlide[];
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CarouselPublishPanel", () => {
  it("renderiza os campos de legenda e agendamento e o botão de publicar", () => {
    render(<CarouselPublishPanel slides={fakeSlides(3)} formatId={formatId} userId="user-1" />);

    expect(screen.getByLabelText("Legenda")).toBeInTheDocument();
    expect(screen.getByLabelText("Agendar para (opcional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });

  it('mostra um erro e não gera nenhum slide se "Agendar" é clicado sem escolher uma data', async () => {
    render(<CarouselPublishPanel slides={fakeSlides(3)} formatId={formatId} userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/escolha uma data/i);
    expect(renderSlideToBlobMock).not.toHaveBeenCalled();
  });

  it("mostra um erro e não gera nenhum slide com menos de 2 slides", async () => {
    render(<CarouselPublishPanel slides={fakeSlides(1)} formatId={formatId} userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/pelo menos 2 slides/i);
    expect(renderSlideToBlobMock).not.toHaveBeenCalled();
  });

  it("mostra um erro e não gera nenhum slide com mais de 10 slides", async () => {
    render(<CarouselPublishPanel slides={fakeSlides(11)} formatId={formatId} userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/até 10 imagens/i);
    expect(renderSlideToBlobMock).not.toHaveBeenCalled();
  });

  it('"Publicar agora": gera um JPEG por slide (em sequência), sobe cada um, cria o post e publica — mostra sucesso', async () => {
    waitForFontsMock.mockResolvedValue(undefined);
    renderSlideToBlobMock.mockImplementation(
      async () => new Blob(["fake"], { type: "image/jpeg" }),
    );
    uploadPresignedMock
      .mockResolvedValueOnce({ url: "https://blob.example.com/slide-01.jpg" })
      .mockResolvedValueOnce({ url: "https://blob.example.com/slide-02.jpg" })
      .mockResolvedValueOnce({ url: "https://blob.example.com/slide-03.jpg" });

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

    render(<CarouselPublishPanel slides={fakeSlides(3)} formatId={formatId} userId="user-1" />);

    fireEvent.change(screen.getByLabelText("Legenda"), { target: { value: "Minha legenda" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Carrossel publicado com sucesso"));

    expect(renderSlideToBlobMock).toHaveBeenCalledTimes(3);
    expect(renderSlideToBlobMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), "image/jpeg", 0.92);
    expect(uploadPresignedMock).toHaveBeenCalledTimes(3);

    const createCall = fetchMock.mock.calls.find(([url]) => url === "/api/instagram/posts");
    expect(createCall).toBeTruthy();
    const createBody = JSON.parse((createCall![1] as RequestInit).body as string);
    expect(createBody).toEqual({
      mediaUrls: [
        "https://blob.example.com/slide-01.jpg",
        "https://blob.example.com/slide-02.jpg",
        "https://blob.example.com/slide-03.jpg",
      ],
      caption: "Minha legenda",
      scheduledAt: null,
      timezone: expect.any(String),
    });
  });

  it('"Agendar" com uma data futura cria o post SCHEDULED sem chamar a rota de publicar', async () => {
    waitForFontsMock.mockResolvedValue(undefined);
    renderSlideToBlobMock.mockImplementation(async () => new Blob(["fake"], { type: "image/jpeg" }));
    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/slide.jpg" });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/instagram/posts") {
        return Promise.resolve(new Response(JSON.stringify({ postId: "post-1" }), { status: 201 }));
      }
      throw new Error(`fetch inesperado: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const futureLocal = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    render(<CarouselPublishPanel slides={fakeSlides(2)} formatId={formatId} userId="user-1" />);
    fireEvent.change(screen.getByLabelText("Agendar para (opcional)"), { target: { value: futureLocal } });
    fireEvent.click(screen.getByRole("button", { name: "Agendar" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Publicação agendada com sucesso"));

    expect(fetchMock).toHaveBeenCalledTimes(1); // só criou o post, nunca chamou /publish
  });

  it("mostra a mensagem de erro do servidor quando a criação do post falha", async () => {
    waitForFontsMock.mockResolvedValue(undefined);
    renderSlideToBlobMock.mockImplementation(async () => new Blob(["fake"], { type: "image/jpeg" }));
    uploadPresignedMock.mockResolvedValue({ url: "https://blob.example.com/slide.jpg" });

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Um carrossel precisa ter entre 2 e 10 imagens." }), { status: 400 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<CarouselPublishPanel slides={fakeSlides(2)} formatId={formatId} userId="user-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Publicar agora" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Um carrossel precisa ter entre 2 e 10 imagens.");
  });
});
