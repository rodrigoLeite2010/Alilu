import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuthenticatedCarouselComposer } from "@/components/instagram/AuthenticatedCarouselComposer";
import {
  createCarouselSlide,
  GENERATED_CAROUSEL_TEMPLATE_ID,
  GENERATED_CAROUSEL_TEXT_SLOT,
  type CarouselEditorState,
} from "@/lib/instagram/carousel/carousel-state";
import { updateTextValue } from "@/lib/instagram/editor-state";

// Desde o Carrossel automático (ETAPA 8/9), o editor abre no Estado 1
// ("Criação") quando não recebe um carrossel pronto — mesma decisão que
// InstagramCarouselEditorTool.test.tsx já cobre em detalhe. Aqui simulamos
// só o suficiente para passar pelo Estado 1 e chegar ao Estado 2, onde a
// composição com CarouselPublishPanel (o que este teste cobre) aparece.
vi.mock("@/lib/instagram/carousel/auto-carousel", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/carousel/auto-carousel")>(
    "@/lib/instagram/carousel/auto-carousel"
  );
  return {
    ...actual,
    buildCarouselFromPastedText: vi.fn(async () => {
      const slide = createCarouselSlide("quadrado", GENERATED_CAROUSEL_TEMPLATE_ID);
      const withImage = { ...slide.state, backgroundImage: { ...slide.state.backgroundImage, url: "blob:seed" } };
      const withText = updateTextValue(withImage, GENERATED_CAROUSEL_TEXT_SLOT, "Slide gerado.");
      const state: CarouselEditorState = {
        formatId: "quadrado",
        slides: [{ ...slide, order: 0, state: withText }],
        selectedSlideId: slide.id,
        originalText: "Slide gerado.",
      };
      return { state, overflowText: null };
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

/**
 * Cobre só a composição em si (CarouselEditorTool + CarouselPublishPanel
 * amarrados por userId) — o comportamento de publicação de verdade já é
 * coberto por InstagramCarouselPublishPanel.test.tsx, e o editor visual em
 * si por InstagramCarouselEditorTool.test.tsx.
 */
describe("AuthenticatedCarouselComposer", () => {
  it("renderiza o editor com o painel de publicação já presente, depois de gerar o carrossel (Estado 1 → Estado 2)", async () => {
    render(<AuthenticatedCarouselComposer userId="user-1" />);

    // Estado 1 (Criação) é o ponto de partida — sem login nenhuma diferença aqui.
    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Slide gerado." } });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));

    expect(await screen.findByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });
});
