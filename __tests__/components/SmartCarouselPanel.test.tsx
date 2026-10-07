import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SmartCarouselPanel } from "@/components/instagram/content-automation/SmartCarouselPanel";
import { DEFAULT_SMART_CAROUSEL_CONFIG } from "@/lib/content-automation/smart-carousel/config";

vi.mock("@/components/instagram/content-automation/MediaPicker", () => ({ MediaPicker: () => <div>picker</div> }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function setup() {
  return render(<SmartCarouselPanel automationId="auto-1" userId="u1" initial={DEFAULT_SMART_CAROUSEL_CONFIG} />);
}

describe("SmartCarouselPanel", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("salva com a ação update-smart-carousel", async () => {
    const fetchMock = vi.fn(async () => json({}));
    global.fetch = fetchMock as unknown as typeof fetch;
    setup();
    fireEvent.change(screen.getByLabelText("Quantidade de slides"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar opções" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const body = JSON.parse(String(calls[0][1].body));
    expect(body.action).toBe("update-smart-carousel");
    expect(body.config.slideCount).toBe(6);
    expect(await screen.findByText(/Salvo/)).toBeInTheDocument();
  });

  it("imagens próprias só aparecem em 'minhas imagens' e 'combinar'", () => {
    setup();
    expect(screen.queryByText("picker")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Imagens"), { target: { value: "COMBINED" } });
    expect(screen.getByText("picker")).toBeInTheDocument();
  });

  it("Gerar exemplo: salva, gera e oferece abrir no editor (sem publicar)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const action = JSON.parse(String(init?.body)).action;
      return action === "smart-carousel-preview" ? json({ projectId: "proj-9", warnings: [] }) : json({});
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Gerar exemplo" }));
    const link = await screen.findByRole("link", { name: /Abrir o exemplo/ });
    expect(link).toHaveAttribute("href", "/instagram/carrossel-inteligente/proj-9");
    expect(screen.getByText(/Nada foi publicado/)).toBeInTheDocument();
  });

  it("mostra o erro da API", async () => {
    global.fetch = vi.fn(async () => json({ error: "Sem acesso ao Carrossel Inteligente." }, 400)) as unknown as typeof fetch;
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Gerar exemplo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem acesso ao Carrossel Inteligente.");
  });
});
