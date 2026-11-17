import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RadarCreateForm } from "@/components/viral-radar/RadarCreateForm";

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/content-automation/accounts") {
      return new Response(JSON.stringify({ accounts: [{ id: "11111111-1111-4111-8111-111111111111", igUsername: "gta6br", status: "connected" }] }));
    }
    if (url === "/api/facebook/pages") return new Response(JSON.stringify({ configured: true, pages: [] }));
    if (url === "/api/viral-radars" && init?.method === "POST") return new Response(JSON.stringify({ radarId: "r-1", queueId: "q-1" }), { status: 201 });
    if (url === "/api/viral-radars") {
      return new Response(JSON.stringify({ connectors: { YOUTUBE_SEARCH: { available: true, reason: null }, TIKTOK: { available: false, reason: "Pendente: TikTok" } } }));
    }
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("Novo Radar Viral", () => {
  it("vem com os padrões do Radar GTA 6 Brasil, exige conta e declaração e envia a publicação para a fila existente", async () => {
    render(<RadarCreateForm initialCategory="games" initialTheme="gta-6" />);
    expect((screen.getByLabelText("Nome do radar") as HTMLInputElement).value).toBe("Radar GTA 6 Brasil");
    expect((screen.getByLabelText(/Palavras-chave/) as HTMLTextAreaElement).value).toContain("GTA 6 Brasil");
    expect((screen.getByLabelText("Visualizações mínimas") as HTMLInputElement).value).toBe("100000");
    expect(screen.getByRole("button", { name: "A cada 6 horas" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Criar radar" }));
    expect(await screen.findByText(/Escolha a conta do Instagram de destino/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("option", { name: "@gta6br" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Conta do Instagram"), { target: { value: "11111111-1111-4111-8111-111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar radar" }));
    expect(await screen.findByText(/Confirme a declaração de direitos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Vídeos públicos não são considerados autorizados/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar radar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/radar-viral/r-1?criado=1"));
    const body = JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === "/api/viral-radars" && init?.method === "POST")![1].body);
    expect(body).toMatchObject({ category: "games", theme: "gta-6", frequencyMinutes: 360, queueMin: 5, queueTarget: 15, rightsConfirmed: true, activatePublishing: false });
    expect(body.publication).toMatchObject({ instagramAccountId: "11111111-1111-4111-8111-111111111111", publishToInstagram: true, facebookPageIds: [] });
    expect(body.publication.schedule).toMatchObject({ publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, timezone: "America/Sao_Paulo" });
    expect(body.sources).toEqual([expect.objectContaining({ type: "YOUTUBE_SEARCH", license: "NONE" })]);
  });
});
