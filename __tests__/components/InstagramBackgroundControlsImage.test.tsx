import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/instagram/image-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/image-utils")>("@/lib/instagram/image-utils");
  return {
    ...actual,
    createImageObjectUrl: () => "blob:nova",
    revokeImageObjectUrl: vi.fn(),
    loadImageElement: vi.fn().mockResolvedValue({ naturalWidth: 800, naturalHeight: 600 }),
  };
});

const { BackgroundControls } = await import("@/components/tools/instagram-post-creator/BackgroundControls");
const { createInitialEditorState, setBackgroundImage } = await import("@/lib/instagram/editor-state");

function stateWithImage() {
  return setBackgroundImage(createInitialEditorState(), { url: "blob:atual", fileName: "foto.jpg", naturalWidth: 1000, naturalHeight: 500 });
}

function renderControls(state = stateWithImage(), extra: Record<string, unknown> = {}) {
  const handlers = {
    onColorComboChange: vi.fn(),
    onBackgroundColorChange: vi.fn(),
    onBadgeColorsChange: vi.fn(),
    onImageChange: vi.fn(),
    onImageRemoved: vi.fn(),
    onImageFocusChange: vi.fn(),
    onImageZoomChange: vi.fn(),
    ...extra,
  };
  render(<BackgroundControls state={state} {...handlers} />);
  return handlers;
}

describe("imagem do usuário no template", () => {
  it("sem imagem: convite para adicionar a própria imagem", () => {
    renderControls(createInitialEditorState());
    expect(screen.getByText("Adicionar minha imagem")).toBeInTheDocument();
  });

  it("upload recusa formatos fora de JPG/PNG/WEBP", async () => {
    renderControls(createInitialEditorState());
    const input = screen.getByTestId("instagram-post-image-upload");
    fireEvent.change(input, { target: { files: [new File(["gif"], "a.gif", { type: "image/gif" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/JPG, PNG ou WEBP/);
  });

  it("trocar imagem substitui a foto", async () => {
    const handlers = renderControls();
    fireEvent.change(screen.getByTestId("instagram-post-image-replace"), {
      target: { files: [new File(["png"], "nova.png", { type: "image/png" })] },
    });
    await waitFor(() =>
      expect(handlers.onImageChange).toHaveBeenCalledWith({ url: "blob:nova", fileName: "nova.png", naturalWidth: 800, naturalHeight: 600 }),
    );
  });

  it("zoom: slider e botões ampliar/reduzir", () => {
    const handlers = renderControls();
    fireEvent.change(screen.getByLabelText(/Zoom da imagem/), { target: { value: "2" } });
    expect(handlers.onImageZoomChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagem" }));
    expect(handlers.onImageZoomChange).toHaveBeenLastCalledWith(1.1);
    expect(screen.getByRole("button", { name: "Reduzir imagem" })).toBeDisabled();
  });

  it("remover a imagem", () => {
    const handlers = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Remover imagem" }));
    expect(handlers.onImageRemoved).toHaveBeenCalled();
  });

  it("sem handler de zoom (ex.: carrossel), o controle de zoom não aparece", () => {
    renderControls(stateWithImage(), { onImageZoomChange: undefined });
    expect(screen.queryByLabelText(/Zoom da imagem/)).not.toBeInTheDocument();
  });
});
