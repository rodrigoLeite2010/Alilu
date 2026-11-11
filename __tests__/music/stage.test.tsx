import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Stage } from "@/components/music/Stage";
import { musicApi } from "@/lib/music/client";
import { emptySet, emptySong, type Live, type Program } from "@/lib/music/types";

vi.mock("@/lib/music/client", () => ({ MusicApiError: class extends Error {}, musicApi: vi.fn() }));

const { name, description, date, minutes, notes, finish, delay, sync } = emptySet;
const program: Program = {
  name: name || "Ensaio", description, date, minutes, notes, finish, delay, sync, tracks: ["Primeira música", "Segunda música"].map((title, index) => ({
    item: { id: String(index), songId: String(index), speed: 35, key: "D", notes: "" },
    song: { ...emptySong, id: String(index), revision: 1, title, originalKey: "C", chart: "[C]Minha letra" },
  })),
};
const now = new Date().toISOString();
const session: Live = {
  id: "session", version: 1, updatedAt: now, serverTime: now, ended: false,
  owner: false, leader: false, participant: "guest", program,
  state: { index: 0, position: 0, speed: 35, extent: 600, playing: false },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(musicApi).mockReset();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const step = async (milliseconds: number) => {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
};

it("retoma a faixa e posição atuais ao reconectar um seguidor", async () => {
  vi.mocked(musicApi).mockResolvedValueOnce(session).mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce({ ...session, version: 2, program: undefined, state: { ...session.state, index: 1, position: 0.5 } });
  render(<Stage code="convite" sessionId="" setId="" revision={0} />);
  await step(5);
  expect(screen.getByRole("heading", { name: "Primeira música" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();
  await step(1260);
  expect(screen.getByText(/Conexão interrompida/)).toBeVisible();
  await step(2700);
  await step(40);
  expect(screen.getByRole("heading", { name: "Segunda música" })).toBeVisible();
  expect(screen.queryByText(/Conexão interrompida/)).toBeNull();
  expect(screen.getByLabelText("Letra da música").scrollTop).toBeCloseTo(300);
});

it("rola no ensaio, pausa sem voltar ao início e troca de música", async () => {
  vi.mocked(musicApi).mockResolvedValueOnce(program);
  render(<Stage code="" sessionId="" setId="ensaio" revision={0} />);
  await step(5);
  const viewport = screen.getByLabelText("Letra da música");
  fireEvent.click(screen.getByRole("button", { name: "Iniciar rolagem" }));
  await step(1000);
  expect(viewport.scrollTop).toBeGreaterThan(25);
  fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
  await step(100);
  const paused = viewport.scrollTop;
  await step(1000);
  expect(viewport.scrollTop).toBe(paused);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByRole("heading", { name: "Segunda música" })).toBeVisible();
  expect(screen.getByLabelText("Letra da música").scrollTop).toBe(0);
});

it("avança automaticamente ao final e reinicia a rolagem da próxima faixa", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(215);
  vi.mocked(musicApi).mockResolvedValueOnce({ ...program, finish: "play" });
  render(<Stage code="" sessionId="" setId="ensaio" revision={0} />);
  await step(5);
  fireEvent.click(screen.getByRole("button", { name: "Iniciar rolagem" }));
  await step(500);
  expect(screen.getByRole("heading", { name: "Segunda música" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Pausar" })).toBeVisible();
});

it("espelha só a faixa quando a rolagem do seguidor é independente", async () => {
  vi.mocked(musicApi).mockResolvedValueOnce({ ...session, program: { ...program, sync: "song" } })
    .mockResolvedValueOnce({ ...session, version: 2, program: undefined, state: { ...session.state, index: 1, position: 0.8, playing: true } });
  render(<Stage code="convite" sessionId="" setId="" revision={0} />);
  await step(5);
  expect(screen.getByRole("button", { name: "Iniciar rolagem" })).toBeVisible();
  await step(1300);
  await step(40);
  expect(screen.getByRole("heading", { name: "Segunda música" })).toBeVisible();
  expect(screen.getByLabelText("Letra da música").scrollTop).toBe(0);
});

it("transpõe cifras antigas sem tom cadastrado durante a rolagem", async () => {
  const [track] = program.tracks;
  vi.mocked(musicApi).mockResolvedValueOnce({
    ...program,
    tracks: [{ item: { ...track.item, key: "" }, song: {
      ...track.song, originalKey: "", chart: "    Bm   Em\nMinha letra\n    Bm   (passagem)\n[D/F#]Outra frase",
    } }],
  });
  render(<Stage code="" sessionId="" setId="ensaio" revision={0} />);
  await step(5);
  fireEvent.click(screen.getByRole("button", { name: "Iniciar rolagem" }));
  fireEvent.click(screen.getByText("Preferências"));
  const target = screen.getByLabelText("Tom nesta tela");
  expect(target).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Tom original da cifra"), { target: { value: "G" } });
  fireEvent.change(target, { target: { value: "B" } });

  const viewport = screen.getByLabelText("Letra da música");
  expect([...viewport.querySelectorAll("strong")].map((chord) => chord.textContent)).toEqual(["D#m", "G#m", "D#m", "F#/A#"]);
  expect(viewport).toHaveTextContent("(passagem)");
  expect(viewport).toHaveTextContent("Minha letra");
  expect(screen.getByRole("button", { name: "Pausar" })).toBeVisible();

  fireEvent.change(target, { target: { value: "D" } });
  expect([...viewport.querySelectorAll("strong")].map((chord) => chord.textContent)).toEqual(["F#m", "Bm", "F#m", "A/C#"]);
});
