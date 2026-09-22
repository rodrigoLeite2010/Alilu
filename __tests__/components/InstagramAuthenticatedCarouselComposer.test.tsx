import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedCarouselComposer } from "@/components/instagram/AuthenticatedCarouselComposer";

/**
 * Cobre só a composição em si (CarouselEditorTool + CarouselPublishPanel
 * amarrados por userId) — o comportamento de publicação de verdade já é
 * coberto por InstagramCarouselPublishPanel.test.tsx, e o editor visual em
 * si por InstagramCarouselEditorTool.test.tsx.
 */
describe("AuthenticatedCarouselComposer", () => {
  it("renderiza o editor com o painel de publicação já presente", () => {
    render(<AuthenticatedCarouselComposer userId="user-1" />);

    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });
});
