import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RadarCreateForm } from "@/components/instagram-radar/RadarCreateForm";

const GTA = "11111111-1111-4111-8111-111111111111";
const PRESTADOR = "22222222-2222-4222-8222-222222222222";
const fetchMock = vi.fn();
const PREVIEW = {
  account: { id: GTA, username: "worldgta", status: "connected" },
  schedule: { timezone: "America/Sao_Paulo", startDate: null, postsPerDay: 5, intervalMinutes: 120, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] },
  dailyTimesLabel: "9h, 11h, 13h, 15h e 17h",
  linksCount: 2,
  readyCount: 0,
  awaitingFileCount: 0,
  awaitingCaptionReviewCount: 0,
  accountDailyCap: 5,
  otherRadarsOnAccount: [],
  nextSlots: ["2026-11-19T12:00:00.000Z"],
  projected: [],
  estimatedDaysForReady: 0,
  estimatedDaysForAll: 1,
  skipped: [],
  warnings: [],
};

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/instagram-radars/accounts") {
      return new Response(
        JSON.stringify({
          needsReconnect: 1,
          accounts: [
            { id: GTA, username: "worldgta", name: "World GTA", profilePictureUrl: null, accountType: "BUSINESS", status: "connected", authProvider: "instagram_login" },
            { id: PRESTADOR, username: "prestadorseguro", name: "Prestador Seguro", profilePictureUrl: null, accountType: "MEDIA_CREATOR", status: "connected", authProvider: "instagram_login" },
          ],
        }),
      );
    }
    if (url === "/api/instagram-radars/preview" && init?.method === "POST") return new Response(JSON.stringify(PREVIEW));
    if (url === "/api/instagram-radars" && init?.method === "POST") return new Response(JSON.stringify({ radarId: "r-1" }), { status: 201 });
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("Novo Radar Instagram", () => {
  it("mostra as contas (foto/nome/@/status/tipo), não pré-seleciona e oferece 1 a 10 publicações por dia", async () => {
    render(<RadarCreateForm />);
    const group = await screen.findByRole("radiogroup", { name: /Conta do Instagram de destino/ });
    expect(within(group).getByText("World GTA")).toBeInTheDocument();
    expect(within(group).getByText("@worldgta")).toBeInTheDocument();
    expect(within(group).getByText("Empresa")).toBeInTheDocument();
    expect(within(group).getByText("Criador de conteúdo")).toBeInTheDocument();
    expect(within(group).getAllByText("Conectada")).toHaveLength(2);
    expect(within(group).getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(/1 conta\(s\) precisam ser reconectadas/)).toBeInTheDocument();
    const perDay = screen.getByLabelText(/Quantas publicações por dia/) as HTMLSelectElement;
    expect([...perDay.options].map((option) => option.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    const interval = screen.getByLabelText("Qual o intervalo mínimo entre as publicações?") as HTMLSelectElement;
    expect([...interval.options].map((option) => option.textContent)).toEqual([
      "A cada 30 minutos",
      "A cada 1 hora",
      "A cada 2 horas",
      "A cada 3 horas",
      "A cada 4 horas",
      "A cada 6 horas",
      "A cada 8 horas",
      "A cada 12 horas",
      "A cada 24 horas",
    ]);
  });

  it("configuração incompatível mostra o motivo e sugestões; compatível mostra os horários", async () => {
    render(<RadarCreateForm />);
    fireEvent.change(screen.getByLabelText(/Horário inicial/), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText(/Quantas publicações por dia/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Qual o intervalo mínimo entre as publicações?"), { target: { value: "120" } });
    const alert = await screen.findByText(/Configuração incompatível/);
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Diminuir para 8/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Qual o intervalo mínimo entre as publicações?"), { target: { value: "60" } });
    expect(await screen.findByText(/8h, 9h, 10h/)).toBeInTheDocument();
  });

  it("conta links, exige conta e autorização, mostra a prévia e só cria depois de confirmar", async () => {
    render(<RadarCreateForm />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Radar GTA 6" } });
    fireEvent.change(screen.getByLabelText(/Links dos vídeos/), {
      target: { value: "https://www.instagram.com/reel/EXEMPLO1/, https://www.instagram.com/reel/EXEMPLO2/\nhttps://www.instagram.com/reel/EXEMPLO1/\nnão-é-link" },
    });
    expect(screen.getByText(/link\(s\) reconhecido\(s\)/).textContent).toMatch(/2 link\(s\) reconhecido\(s\).*1 repetido.*1 inválido/);

    fireEvent.click(screen.getByRole("button", { name: "Visualizar a programação" }));
    expect(await screen.findByText(/Escolha a conta do Instagram de destino/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("radio", { name: "@worldgta" }));
    fireEvent.click(screen.getByRole("button", { name: "Visualizar a programação" }));
    expect(await screen.findByText(/Confirme a autorização/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Declaro que sou o autor/));
    fireEvent.click(screen.getByRole("button", { name: "Visualizar a programação" }));

    expect(await screen.findByText("Prévia do agendamento")).toBeInTheDocument();
    expect(screen.getByText("9h, 11h, 13h, 15h e 17h")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/instagram-radars")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e adicionar à fila" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/instagram/radar/r-1?criado=1"));
    const [, init] = fetchMock.mock.calls.find(([url, options]) => url === "/api/instagram-radars" && options?.method === "POST")!;
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ name: "Radar GTA 6", instagramAccountId: GTA, mode: "AUTHORIZED", authorized: true });
    expect(body.schedule).toMatchObject({ postsPerDay: 3, intervalMinutes: 240, windowStart: "09:00", timezone: "America/Sao_Paulo" });
  });

  it("importa um arquivo TXT com links", async () => {
    render(<RadarCreateForm />);
    const file = new File(["https://cdn.exemplo.com/a.mp4\nhttps://cdn.exemplo.com/b.mp4"], "links.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText(/Importar arquivo TXT/), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/link\(s\) reconhecido\(s\)/).textContent).toMatch(/^2 link/));
  });
});
