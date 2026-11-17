import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { VideoQueueCreateForm } from "@/components/video-queue/VideoQueueCreateForm";

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/content-automation/accounts") {
      return new Response(JSON.stringify({ accounts: [{ id: "11111111-1111-4111-8111-111111111111", igUsername: "gta6br", status: "connected" }, { id: "22222222-2222-4222-8222-222222222222", igUsername: "alilu_tech", status: "connected" }] }));
    }
    if (url === "/api/facebook/pages") {
      return new Response(JSON.stringify({ configured: true, pages: [{ id: "33333333-3333-4333-8333-333333333333", pageName: "GTA 6 BR", status: "connected", linkedIgUsername: "gta6br" }] }));
    }
    if (url === "/api/video-queues" && init?.method === "POST") return new Response(JSON.stringify({ queueId: "q-1" }), { status: 201 });
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("Nova fila de vídeos", () => {
  it("conta os links, exige conta e declaração, e envia as contas escolhidas explicitamente", async () => {
    render(<VideoQueueCreateForm initialCategory="games" initialTheme="gta-6" initialCaptionTemplate="{titulo} #GTA6" />);
    fireEvent.change(screen.getByLabelText(/Cole os links dos vídeos/), {
      target: { value: "https://exemplo.com/video1.mp4\nhttps://exemplo.com/video2.mp4\nhttps://exemplo.com/video1.mp4" },
    });
    expect(screen.getByText(/2 link\(s\) válido\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 repetido/)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("option", { name: "@gta6br" })).toBeInTheDocument());
    // Nada pré-selecionado entre várias contas.
    expect((screen.getByLabelText("Conta do Instagram") as HTMLSelectElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Criar fila/ }));
    expect(await screen.findByText(/Escolha a conta do Instagram/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Conta do Instagram"), { target: { value: "11111111-1111-4111-8111-111111111111" } });
    await waitFor(() => expect(screen.getByText("GTA 6 BR")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: /GTA 6 BR/ }));
    fireEvent.click(screen.getByRole("button", { name: /Criar fila/ }));
    expect(await screen.findByText(/Confirme que você tem os direitos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Declaro que os vídeos/ }));
    fireEvent.click(screen.getByRole("button", { name: /Criar fila/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/instagram/filas/q-1?criada=1"));
    const body = JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === "/api/video-queues" && init?.method === "POST")![1].body);
    expect(body).toMatchObject({
      category: "games",
      theme: "gta-6",
      instagramAccountId: "11111111-1111-4111-8111-111111111111",
      facebookPageIds: ["33333333-3333-4333-8333-333333333333"],
      rightsConfirmed: true,
    });
    expect(body.schedule.publishTimes).toEqual(["09:00", "15:00", "20:00"]);
  });
});
