// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseQueueLink, parseQueueLinks, isForbiddenHost } from "@/lib/video-queue/links";
import { allocateSlots, normalizeScheduleConfig, pickPlannableItems, DEFAULT_SCHEDULE, QueueScheduleError, type QueueScheduleConfig } from "@/lib/video-queue/schedule";
import { buildAiCaptionPrompt, renderCaptionTemplate, resolveItemCaption, validateCaption } from "@/lib/video-queue/captions";
import { defaultCaptionTemplate, findTheme, VIDEO_QUEUE_CATEGORIES } from "@/lib/video-queue/catalog";

const SP: QueueScheduleConfig = { ...DEFAULT_SCHEDULE, timezone: "America/Sao_Paulo", publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3 };
const fmt = (dates: Date[]) => dates.map((date) => date.toISOString());

describe("links da fila", () => {
  it("classifica arquivo direto, Instagram, YouTube, TikTok e outras plataformas", () => {
    expect(parseQueueLink("https://cdn.exemplo.com/videos/a.mp4?token=1#x")).toEqual({
      ok: true,
      link: { sourceUrl: "https://cdn.exemplo.com/videos/a.mp4?token=1#x", normalizedUrl: "https://cdn.exemplo.com/videos/a.mp4?token=1", kind: "DIRECT", platform: null },
    });
    expect(parseQueueLink("https://www.instagram.com/reel/ABCdef123/?igsh=xyz")).toMatchObject({ ok: true, link: { kind: "INSTAGRAM", normalizedUrl: "https://www.instagram.com/reel/ABCdef123/" } });
    expect(parseQueueLink("https://youtu.be/dQw4w9WgXcQ?t=3")).toMatchObject({ ok: true, link: { kind: "YOUTUBE" } });
    expect(parseQueueLink("https://www.tiktok.com/@x/video/123?lang=pt")).toMatchObject({ ok: true, link: { kind: "TIKTOK", normalizedUrl: "https://www.tiktok.com/@x/video/123" } });
    expect(parseQueueLink("https://x.com/a/status/1")).toMatchObject({ ok: true, link: { kind: "OTHER_PLATFORM", platform: "X (Twitter)" } });
  });

  it("recusa links inválidos, internos e privados (primeira barreira contra SSRF)", () => {
    for (const bad of [
      "ftp://exemplo.com/a.mp4",
      "não é link",
      "http://localhost/a.mp4",
      "http://127.0.0.1/a.mp4",
      "http://10.0.0.5/a.mp4",
      "http://169.254.169.254/latest/meta-data",
      "http://192.168.0.10/v.mp4",
      "http://[::1]/a.mp4",
      "http://2130706433/a.mp4",
      "https://user:pass@exemplo.com/a.mp4",
      "https://exemplo.com:8443/a.mp4",
      "http://servidor.internal/a.mp4",
    ]) {
      expect(parseQueueLink(bad).ok, bad).toBe(false);
    }
    expect(isForbiddenHost("cdn.exemplo.com")).toBe(false);
  });

  it("lê um link por linha, separa duplicados e recusados", () => {
    const text = ["https://exemplo.com/video1.mp4", "", "https://exemplo.com/video2.mp4", "https://exemplo.com/video1.mp4", "lixo", "http://10.1.1.1/x.mp4"].join("\n");
    const parsed = parseQueueLinks(text);
    expect(parsed.accepted.map((link) => link.normalizedUrl)).toEqual(["https://exemplo.com/video1.mp4", "https://exemplo.com/video2.mp4"]);
    expect(parsed.duplicates).toEqual(["https://exemplo.com/video1.mp4"]);
    expect(parsed.rejected).toHaveLength(2);
  });

  it("100 links são aceitos; o limite por envio é respeitado", () => {
    const text = Array.from({ length: 250 }, (_, index) => `https://exemplo.com/v${index}.mp4`).join("\n");
    const parsed = parseQueueLinks(text, 100);
    expect(parsed.accepted).toHaveLength(100);
    expect(parsed.overLimit).toBe(true);
  });
});

describe("programação da fila", () => {
  it("valida a configuração", () => {
    expect(() => normalizeScheduleConfig({ publishTimes: [] })).toThrow(QueueScheduleError);
    expect(() => normalizeScheduleConfig({ publishTimes: ["25:00"] })).toThrow(QueueScheduleError);
    expect(() => normalizeScheduleConfig({ publishTimes: ["09:00"], postsPerDay: 3 })).toThrow(/só 1 horário/);
    expect(() => normalizeScheduleConfig({ timezone: "Lua/Base" })).toThrow(/Fuso/);
    expect(() => normalizeScheduleConfig({ weekdays: [] })).toThrow(/dia da semana/);
    const config = normalizeScheduleConfig({ publishTimes: ["20:00", "09:00", "15:00", "09:00"], postsPerDay: "2" });
    expect(config.publishTimes).toEqual(["09:00", "15:00", "20:00"]);
    expect(config.postsPerDay).toBe(2);
  });

  it("distribui 30 vídeos em 3 horários por dia (9h, 15h, 20h de São Paulo)", () => {
    const now = new Date("2026-11-16T10:00:00Z"); // 07:00 em SP
    const slots = allocateSlots({ config: SP, now, occupied: [], count: 30 });
    expect(slots).toHaveLength(30);
    expect(fmt(slots.slice(0, 4))).toEqual([
      "2026-11-16T12:00:00.000Z",
      "2026-11-16T18:00:00.000Z",
      "2026-11-16T23:00:00.000Z",
      "2026-11-17T12:00:00.000Z",
    ]);
    expect(slots[29].toISOString()).toBe("2026-11-25T23:00:00.000Z");
  });

  it("nunca usa horário passado e respeita a data de início e os dias da semana", () => {
    const now = new Date("2026-11-16T19:00:00Z"); // 16:00 SP, segunda
    const slots = allocateSlots({ config: { ...SP, startDate: "2026-11-20", weekdays: [5, 6] }, now, occupied: [], count: 4 });
    expect(fmt(slots)).toEqual(["2026-11-20T12:00:00.000Z", "2026-11-20T18:00:00.000Z", "2026-11-20T23:00:00.000Z", "2026-11-21T12:00:00.000Z"]);
    const today = allocateSlots({ config: SP, now, occupied: [], count: 1 });
    expect(today[0].toISOString()).toBe("2026-11-16T23:00:00.000Z");
  });

  it("respeita agendamentos existentes da conta e o intervalo mínimo", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const occupied = [
      { at: new Date("2026-11-16T12:30:00Z"), own: false }, // 09:30 — a menos de 60 min das 09:00
      { at: new Date("2026-11-16T18:00:00Z"), own: false }, // 15:00 exato
    ];
    const slots = allocateSlots({ config: SP, now, occupied, count: 2 });
    expect(fmt(slots)).toEqual(["2026-11-16T23:00:00.000Z", "2026-11-17T12:00:00.000Z"]);
    // allowSameSlot: libera conflito com publicações de fora da fila
    const same = allocateSlots({ config: { ...SP, allowSameSlot: true }, now, occupied, count: 2 });
    expect(fmt(same)).toEqual(["2026-11-16T12:00:00.000Z", "2026-11-16T18:00:00.000Z"]);
  });

  it("limite diário conta as publicações da própria fila; horizonte corta a materialização", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const occupied = [{ at: new Date("2026-11-16T12:00:00Z"), own: true }];
    const slots = allocateSlots({ config: { ...SP, postsPerDay: 2 }, now, occupied, count: 3, until: new Date("2026-11-17T13:00:00Z") });
    expect(fmt(slots)).toEqual(["2026-11-16T18:00:00.000Z", "2026-11-17T12:00:00.000Z"]);
  });

  it("regra de vídeo não pronto: aguardar segura a ordem; próximo pronto pula", () => {
    const items = [
      { id: "a", status: "SCHEDULED", position: 1 },
      { id: "b", status: "IMPORTING", position: 2 },
      { id: "c", status: "READY", position: 3 },
      { id: "d", status: "ERROR", position: 4 },
      { id: "e", status: "READY", position: 5 },
    ];
    expect(pickPlannableItems(items, { orderMode: "POSITION", notReadyPolicy: "NEXT_READY" }).map((item) => item.id)).toEqual(["c", "e"]);
    expect(pickPlannableItems(items, { orderMode: "POSITION", notReadyPolicy: "WAIT" }).map((item) => item.id)).toEqual([]);
    expect(pickPlannableItems(items, { orderMode: "REVERSE", notReadyPolicy: "WAIT" }).map((item) => item.id)).toEqual(["e", "c"]);
  });
});

describe("legendas e catálogo", () => {
  it("template com variáveis e legenda própria", () => {
    const template = defaultCaptionTemplate("games", "gta-6");
    expect(template).toContain("#GTA6");
    const vars = { tema: "GTA 6", categoria: "Games", numero: 2, total: 20 };
    expect(renderCaptionTemplate("{titulo} — {tema} ({numero}/{total})", { ...vars, titulo: "Perseguição em Vice City" })).toBe("Perseguição em Vice City — GTA 6 (2/20)");
    expect(resolveItemCaption({ caption: null, title: null }, "{titulo}\n\n\n#GTA6", vars)).toBe("#GTA6");
    expect(resolveItemCaption({ caption: "Minha legenda", title: "x" }, "{titulo}", vars)).toBe("Minha legenda");
  });

  it("valida tamanho e hashtags; o prompt de IA proíbe chamar de trailer oficial", () => {
    expect(validateCaption("a".repeat(2201))).toMatch(/2200/);
    expect(validateCaption(Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "))).toMatch(/30 hashtags/);
    expect(validateCaption("ok #GTA6")).toBeNull();
    expect(buildAiCaptionPrompt({ theme: "GTA 6", category: "Games", title: "Gameplay de fã" })).toMatch(/NÃO afirme que é trailer oficial/);
  });

  it("catálogo extensível: Games com GTA 6, GTA 5 e outros", () => {
    expect(VIDEO_QUEUE_CATEGORIES.find((category) => category.id === "games")?.themes.map((theme) => theme.id)).toEqual(["gta-6", "gta-5", "outros-jogos"]);
    expect(findTheme("games", "gta-6")?.name).toBe("GTA 6");
    expect(findTheme("games", "nao-existe")).toBeNull();
  });
});
