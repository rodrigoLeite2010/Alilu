import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@vercel/blob/client", () => ({ uploadPresigned: vi.fn() }));

import { RadarPanel } from "@/components/instagram-radar/RadarPanel";

const schedule = { timezone: "America/Sao_Paulo", startDate: null, postsPerDay: 5, intervalMinutes: 120, windowStart: "09:00", windowEnd: "22:00", weekdays: [0, 1, 2, 3, 4, 5, 6] };
function dashboard(status: string) {
  return {
    radar: { id: "r-1", name: "Radar GTA 6", status, pauseReason: null, pausedBySystem: false, instagramAccountId: "a-1", schedule, notReadyPolicy: "NEXT_READY", captionTemplate: "{titulo}", hashtags: "#gta6", missingCaptionPolicy: "DEFAULT", createdAt: "2026-11-18T10:00:00.000Z", activatedAt: null },
    counts: { total: 3, imported: 2, pending: 1, waitingFile: 1, ready: 1, scheduled: 1, published: 0, errors: 0, cancelled: 0, nextPublicationAt: "2026-11-19T12:00:00.000Z" },
    nextPublicationAt: "2026-11-19T12:00:00.000Z",
    account: { id: "a-1", username: "worldgta", status: "connected" },
    items: [
      { id: "i-1", position: 1, sourceUrl: "https://cdn.exemplo.com/a.mp4", sourceKind: "DIRECT", status: "SCHEDULED", statusMessage: null, errorCode: null, attemptsCount: 1, nextAttemptAt: null, thumbnailUrl: null, videoUrl: null, durationSeconds: 30, width: 1080, height: 1920, fileSizeBytes: 1, facebookIncompatibleReason: null, title: "Vídeo A", caption: null, facebookCaption: null, postId: "p-1", scheduledAt: "2026-11-19T12:00:00.000Z", facebookNote: null, publishedAt: null, post: { id: "p-1", status: "SCHEDULED", error: null, publishedAt: null, publishToInstagram: true }, destinations: [], awaitingCaptionReview: false },
      { id: "i-2", position: 2, sourceUrl: "https://www.instagram.com/reel/X/", sourceKind: "INSTAGRAM", status: "WAITING_FILE", statusMessage: "Link registrado só como referência", errorCode: "AUTHORIZED_FILE_REQUIRED", attemptsCount: 0, nextAttemptAt: null, thumbnailUrl: null, videoUrl: null, durationSeconds: null, width: null, height: null, fileSizeBytes: null, facebookIncompatibleReason: null, title: null, caption: null, facebookCaption: null, postId: null, scheduledAt: null, facebookNote: null, publishedAt: null, post: null, destinations: [], awaitingCaptionReview: false },
    ],
    preview: {
      account: { id: "a-1", username: "worldgta", status: "connected" }, schedule, dailyTimesLabel: "9h, 11h, 13h, 15h e 17h", linksCount: 2, readyCount: 1, awaitingFileCount: 1, awaitingCaptionReviewCount: 0,
      accountDailyCap: 5, otherRadarsOnAccount: [], nextSlots: ["2026-11-19T14:00:00.000Z"], projected: [], estimatedDaysForReady: 1, estimatedDaysForAll: 1, skipped: [], warnings: [],
    },
    events: [{ id: "e-1", itemId: null, event: "created", message: "Radar criado", createdAt: "2026-11-18T10:00:00.000Z" }],
  };
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/instagram-radars/r-1" && init?.method === "PATCH") return new Response(JSON.stringify(dashboard("ACTIVE")));
    if (url === "/api/instagram-radars/r-1") return new Response(JSON.stringify(dashboard("DRAFT")));
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("Painel do Radar Instagram", () => {
  it("mostra conta, contadores, vídeos (sem Facebook) e ativa o radar", async () => {
    render(<RadarPanel radarId="r-1" userId="u-1" />);
    expect(await screen.findByRole("heading", { name: "Radar GTA 6" })).toBeInTheDocument();
    expect(screen.getByText("@worldgta")).toBeInTheDocument();
    expect(screen.getByText("Vídeo A")).toBeInTheDocument();
    expect(screen.getByText(/Aguardando autorização ou arquivo/)).toBeInTheDocument();
    expect(screen.queryByText(/Facebook/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publicar agora/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Programação" }));
    expect(screen.getByText("9h, 11h, 13h, 15h e 17h")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar radar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1].body))).toEqual({ action: "activate" });
  });
});
