import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BackgroundControls } from "@/components/tools/instagram-post-creator/BackgroundControls";
import { createInitialEditorState } from "@/lib/instagram/editor-state";

vi.mock("@/lib/instagram/image-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/instagram/image-utils")>();
  return {
    ...actual,
    createImageObjectUrl: vi.fn(() => "blob:mock-url"),
    revokeImageObjectUrl: vi.fn(),
    loadImageElement: vi.fn(() => Promise.resolve({ naturalWidth: 800, naturalHeight: 600 } as HTMLImageElement)),
  };
});

function renderControls() {
  const state = createInitialEditorState();
  const handlers = {
    onColorComboChange: vi.fn(),
    onBackgroundColorChange: vi.fn(),
    onBadgeColorsChange: vi.fn(),
    onImageChange: vi.fn(),
    onImageRemoved: vi.fn(),
    onImageFocusChange: vi.fn(),
  };
  render(<BackgroundControls state={state} {...handlers} />);
  return handlers;
}

describe("BackgroundControls — upload de imagem (ETAPA 5.2)", () => {
  it("mostra uma mensagem amigável ao enviar um arquivo com formato não suportado", async () => {
    renderControls();

    const input = screen.getByTestId("instagram-post-image-upload");
    const invalidFile = new File([new Uint8Array(10)], "documento.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/formato não suportado/i);
  });

  it("aceita uma imagem válida e avisa o componente pai com as dimensões carregadas", async () => {
    const handlers = renderControls();

    const input = screen.getByTestId("instagram-post-image-upload");
    const validFile = new File([new Uint8Array(10)], "foto.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => expect(handlers.onImageChange).toHaveBeenCalledTimes(1));
    expect(handlers.onImageChange).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "foto.png", naturalWidth: 800, naturalHeight: 600 })
    );
  });

  it("permite escolher uma combinação de cores pronta", () => {
    const handlers = renderControls();

    fireEvent.click(screen.getByTitle("Meia-noite"));
    expect(handlers.onColorComboChange).toHaveBeenCalledWith("midnight");
  });
});
