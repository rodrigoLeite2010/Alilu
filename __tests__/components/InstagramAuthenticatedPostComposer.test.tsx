import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedPostComposer } from "@/components/instagram/AuthenticatedPostComposer";

/**
 * Cobre só a composição (PostEditorTool + PublicationComposerPanel). O
 * fluxo de publicação é coberto por InstagramPublicationComposerPanel.test.tsx.
 */
afterEach(() => vi.unstubAllGlobals());

describe("AuthenticatedPostComposer", () => {
  it("renderiza o editor com o painel de publicação já presente", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ authenticated: true, connected: true, username: "alilu.tec", userId: "u1" }))),
    );
    render(<AuthenticatedPostComposer userId="user-1" />);

    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar no Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agendar publicação" })).toBeInTheDocument();
  });
});
