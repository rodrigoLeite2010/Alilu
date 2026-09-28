import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// Desde o Carrossel automático (ETAPA 8/9), o editor abre no Estado 1
// ("Criação") quando não recebe um carrossel pronto — o teste abaixo passa
// por ele antes de chegar ao editor/painel de publicação (ver
// InstagramCarouselEditorTool.test.tsx para a cobertura completa do Estado 1).
vi.mock("@/lib/instagram/carousel/auto-carousel", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/carousel/auto-carousel")>(
    "@/lib/instagram/carousel/auto-carousel"
  );
  return {
    ...actual,
    buildCarouselFromPastedText: vi.fn(async () => {
      const { createCarouselSlide, GENERATED_CAROUSEL_TEMPLATE_ID, GENERATED_CAROUSEL_TEXT_SLOT } = await import(
        "@/lib/instagram/carousel/carousel-state"
      );
      const { updateTextValue } = await import("@/lib/instagram/editor-state");
      const slide = createCarouselSlide("quadrado", GENERATED_CAROUSEL_TEMPLATE_ID);
      const withImage = { ...slide.state, backgroundImage: { ...slide.state.backgroundImage, url: "blob:seed" } };
      const withText = updateTextValue(withImage, GENERATED_CAROUSEL_TEXT_SLOT, "Slide gerado.");
      return {
        state: {
          formatId: "quadrado",
          slides: [{ ...slide, order: 0, state: withText }],
          selectedSlideId: slide.id,
          originalText: "Slide gerado.",
        },
        overflowText: null,
      };
    }),
  };
});
vi.mock("@/lib/instagram/image-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/image-utils")>("@/lib/instagram/image-utils");
  return {
    ...actual,
    createImageObjectUrl: () => "blob:nova",
    revokeImageObjectUrl: vi.fn(),
    loadImageElement: vi.fn().mockResolvedValue({ naturalWidth: 800, naturalHeight: 600 }),
  };
});

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const getInstagramAccountForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountForUser: (...args: unknown[]) => getInstagramAccountForUserMock(...args),
}));

const { default: CalendarioNovoCarrosselPage } = await import(
  "@/app/instagram/painel/calendario/novo-carrossel/page"
);

describe("CalendarioNovoCarrosselPage", () => {
  beforeEach(() => {
    authMock.mockReset();
    getInstagramAccountForUserMock.mockReset();
  });

  it("mostra o link de entrar quando não há sessão", async () => {
    authMock.mockResolvedValue(null);

    const jsx = await CalendarioNovoCarrosselPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Começar a criar sem login" })).toBeInTheDocument();
    expect(getInstagramAccountForUserMock).not.toHaveBeenCalled();
  });

  it("pede para conectar a conta quando o usuário está logado mas não tem conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const jsx = await CalendarioNovoCarrosselPage();
    render(jsx);

    expect(screen.getByRole("link", { name: "Ir para o painel" })).toBeInTheDocument();
  });

  it("renderiza o editor de carrossel com o painel de publicação quando há conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      igUserId: "178414000",
      igUsername: "alilu.tec",
      status: "connected",
      tokenExpiresAt: null,
      scopes: null,
      connectedAt: new Date(),
      updatedAt: new Date(),
    });

    const jsx = await CalendarioNovoCarrosselPage();
    render(jsx);

    expect(screen.getByText("@alilu.tec", { exact: false })).toBeInTheDocument();

    // Estado 1 (Criação) é o ponto de partida — gera o carrossel para chegar ao editor/painel de publicação.
    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Slide gerado." } });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));

    expect(await screen.findByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
  });
});
