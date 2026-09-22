import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedPostComposer } from "@/components/instagram/AuthenticatedPostComposer";

/**
 * Cobre só a composição em si (PostEditorTool + PublishPanel amarrados
 * por userId) — o comportamento de publicação de verdade já é coberto
 * por InstagramPublishPanel.test.tsx, e o editor visual em si por
 * InstagramPostEditorTool.test.tsx.
 */
describe("AuthenticatedPostComposer", () => {
  it("renderiza o editor com o painel de publicação já presente", () => {
    render(<AuthenticatedPostComposer userId="user-1" />);

    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar agora" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar" })).toBeInTheDocument();
  });
});
