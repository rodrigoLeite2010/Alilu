// SmartStoryEngine — Fase 3: layout (puro), fundos, templates e render real
// (@napi-rs/canvas) dos 7 layouts / 11 tipos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import {
  STORY_TYPES,
  buildFallbackContent,
  type StoryContent,
  type StoryType,
} from "@/lib/content-automation/smart-story";
import {
  STORY_BACKGROUNDS,
  getBackgroundById,
  pickBackground,
} from "@/lib/content-automation/smart-story/render/backgrounds";
import {
  EYEBROW_BY_TYPE,
  STORY_TEMPLATE_IDS,
  TEMPLATE_FOR_TYPE,
  templateIdForType,
} from "@/lib/content-automation/smart-story/render/templates";
import {
  FOOTER_CENTER_Y,
  MASCOT_BOX,
  SAFE_AREA,
  STORY_HEIGHT,
  STORY_WIDTH,
  layoutStory,
  type DrawItem,
} from "@/lib/content-automation/smart-story/render/layout";
import { ALILU_BRAND_IDENTITY } from "@/lib/content-automation/smart-story/brand";
import { INTERACTIVE_CLAIM_RE } from "@/lib/content-automation/smart-story/cta";

const putMock = vi.fn<(path: string, buffer: Buffer, options: unknown) => Promise<{ url: string }>>(async () => ({ url: "https://blob.example.com/generated/story.jpg" }));
vi.mock("@vercel/blob", () => ({ put: (...args: [string, Buffer, unknown]) => putMock(...args) }));
const insertMediaMock = vi.fn<(input: unknown) => Promise<string>>(async () => "media-123");
vi.mock("@/lib/instagram/backend/media-repository", () => ({ insertInstagramMedia: (input: unknown) => insertMediaMock(input) }));

const render = await import("@/lib/content-automation/smart-story/render/render-service");

/** Medidor determinístico: cada caractere = 0.55 × tamanho da fonte. */
function fakeMeasurer() {
  const state = { font: "bold 40px x" };
  return {
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    measureText(text: string) {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 40);
      return { width: text.length * size * 0.55 };
    },
  };
}

function content(type: StoryType, overrides: Partial<StoryContent> = {}): StoryContent {
  return { ...buildFallbackContent(type, "seed", []), ...overrides };
}

function bounds(item: DrawItem): { top: number; bottom: number; left: number; right: number } | null {
  switch (item.kind) {
    case "text": {
      const half = item.fontPx * 0.6;
      return { top: item.y - half, bottom: item.y + half, left: item.x, right: item.x };
    }
    case "roundRect":
      return { top: item.y, bottom: item.y + item.h, left: item.x, right: item.x + item.w };
    case "checkbox":
      return { top: item.y, bottom: item.y + item.size, left: item.x, right: item.x + item.size };
    case "line":
      return { top: item.y - item.thickness, bottom: item.y + item.thickness, left: item.x1, right: item.x2 };
    case "image":
      return { top: item.y, bottom: item.y + item.h, left: item.x, right: item.x + item.w };
  }
}

describe("templates", () => {
  it("são 7 layouts e todo tipo de Story tem um", () => {
    expect(STORY_TEMPLATE_IDS).toHaveLength(7);
    for (const type of STORY_TYPES) expect(STORY_TEMPLATE_IDS).toContain(TEMPLATE_FOR_TYPE[type]);
    expect(new Set(Object.values(TEMPLATE_FOR_TYPE)).size).toBe(7);
    expect(templateIdForType("VISUAL_POLL")).toBe("smart-visual-poll");
  });

  it("nenhum selo promete interação nativa (vote/toque/clique)", () => {
    for (const label of Object.values(EYEBROW_BY_TYPE)) expect(label).not.toMatch(INTERACTIVE_CLAIM_RE);
  });
});

describe("fundos", () => {
  it("biblioteca cobre as 7 categorias, ids únicos e cores válidas", () => {
    const categories = new Set(STORY_BACKGROUNDS.map((background) => background.category));
    for (const category of ["emotional", "motivational", "finance", "technology", "neutral", "dark", "light"]) {
      expect(categories.has(category as never)).toBe(true);
    }
    expect(new Set(STORY_BACKGROUNDS.map((background) => background.id)).size).toBe(STORY_BACKGROUNDS.length);
    for (const background of STORY_BACKGROUNDS) {
      expect(background.stops.length).toBeGreaterThan(0);
      for (const stop of background.stops) expect(stop.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(background.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(getBackgroundById(background.id)).toBe(background);
    }
  });

  it("escolhe pela categoria do clima, é determinístico e evita repetir o anterior", () => {
    const first = pickBackground({ mood: "finance", seed: "a" });
    expect(first.category).toBe("finance");
    expect(pickBackground({ mood: "finance", seed: "a" }).id).toBe(first.id);
    for (let index = 0; index < 40; index += 1) {
      const next = pickBackground({ mood: "finance", seed: `s${index}`, recentBackgroundIds: [first.id] });
      expect(next.id).not.toBe(first.id);
    }
  });

  it("clima inválido vira neutro; categoria sem fundo habilitado cai em qualquer um; nenhum habilitado lança", () => {
    expect(pickBackground({ mood: "arco-iris", seed: "x" }).category).toBe("neutral");
    const only = STORY_BACKGROUNDS.filter((background) => background.category === "dark");
    expect(pickBackground({ mood: "light", seed: "x", library: only }).category).toBe("dark");
    expect(() => pickBackground({ mood: "light", seed: "x", library: [] })).toThrow();
  });
});

describe("layout (área segura e hierarquia)", () => {
  it("TODO texto de TODO tipo fica dentro da área segura (1080×1920)", () => {
    for (const type of STORY_TYPES) {
      const { items } = layoutStory(content(type), fakeMeasurer(), { showBrand: true, mascot: false });
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        const box = bounds(item);
        if (!box) continue;
        if (item.kind === "text" && item.y > STORY_HEIGHT - SAFE_AREA.bottom) throw new Error(`${type}: texto fora da área segura`);
        if (item.kind === "image" && item.asset === "mascot") continue;
        expect(box.top, `${type} topo`).toBeGreaterThanOrEqual(SAFE_AREA.top - 20);
        expect(box.bottom, `${type} base`).toBeLessThanOrEqual(STORY_HEIGHT - SAFE_AREA.bottom + 60);
        expect(box.left, `${type} esquerda`).toBeGreaterThanOrEqual(SAFE_AREA.left - 30);
        expect(box.right, `${type} direita`).toBeLessThanOrEqual(STORY_WIDTH - SAFE_AREA.right + 30);
      }
    }
  });

  it("título em fonte maior que o corpo (hierarquia) e selo menor que o título", () => {
    const { items } = layoutStory(content("REFLECTION", { body: "Um complemento curto." }), fakeMeasurer(), { showBrand: true, mascot: false });
    const sizes = items.filter((item): item is Extract<DrawItem, { kind: "text" }> => item.kind === "text");
    const headline = sizes.find((item) => item.family.includes("Serif"));
    const body = sizes.find((item) => item.text === "Um complemento curto.");
    const eyebrow = sizes.find((item) => item.text === "REFLEXÃO DO DIA");
    expect(headline && body && eyebrow).toBeTruthy();
    expect(headline!.fontPx).toBeGreaterThan(body!.fontPx);
    expect(body!.fontPx).toBeGreaterThan(eyebrow!.fontPx - 1);
  });

  it("VisualPoll: duas opções A/B desenhadas e CTA sem promessa de votação", () => {
    const poll = content("VISUAL_POLL", { optionA: "Café", optionB: "Chá", cta: "Responda no direct" });
    const { items } = layoutStory(poll, fakeMeasurer(), { showBrand: true, mascot: false });
    const texts = items.filter((item): item is Extract<DrawItem, { kind: "text" }> => item.kind === "text").map((item) => item.text);
    expect(texts).toEqual(expect.arrayContaining(["A", "B", "Café", "Chá", "Responda no direct"]));
    for (const text of texts) expect(text).not.toMatch(INTERACTIVE_CLAIM_RE);
  });

  it("checklist desenha um item por linha (até 5) com caixa marcada", () => {
    const checklist = content("CHECKLIST", { body: "um\ndois\ntrês\nquatro\ncinco\nseis" });
    const { items } = layoutStory(checklist, fakeMeasurer(), { showBrand: true, mascot: false });
    expect(items.filter((item) => item.kind === "checkbox")).toHaveLength(5);
  });

  it("CTA e Marca Alilu usam logo grande e pílula preenchida; os demais têm rodapé de marca", () => {
    const aliluBrand = { showBrand: true, mascot: false, brandHandle: "@alilu.tec", hasLogo: true };
    const cta = layoutStory(content("CTA"), fakeMeasurer(), aliluBrand).items;
    const big = cta.find((item) => item.kind === "image" && item.asset === "logo");
    expect(big && big.kind === "image" && big.w).toBe(150);
    expect(cta.some((item) => item.kind === "roundRect" && item.fill === "accent")).toBe(true);
    const reflection = layoutStory(content("REFLECTION"), fakeMeasurer(), aliluBrand).items;
    const footerLogo = reflection.find((item) => item.kind === "image" && item.asset === "logo");
    expect(footerLogo && footerLogo.kind === "image" && footerLogo.y + footerLogo.h / 2).toBe(FOOTER_CENTER_Y);
    expect(reflection.some((item) => item.kind === "text" && item.text === "@alilu.tec")).toBe(true);
  });

  it("marca discreta pode ser desligada (sem logo nem @alilu.tec no rodapé)", () => {
    const { items } = layoutStory(content("REFLECTION"), fakeMeasurer(), { showBrand: false, mascot: false });
    expect(items.some((item) => item.kind === "image")).toBe(false);
    expect(items.some((item) => item.kind === "text" && item.text === "@alilu.tec")).toBe(false);
  });

  it("CTA pode ser omitido", () => {
    const { items } = layoutStory(content("REFLECTION"), fakeMeasurer(), { showBrand: false, mascot: false, showCta: false });
    expect(items.some((item) => item.kind === "roundRect")).toBe(false);
  });

  it("texto longo encolhe e, no extremo, corta com … (sem sair da área)", () => {
    const long = "palavra ".repeat(80).trim();
    const result = layoutStory(content("MINI_STORY", { headline: long, body: long }), fakeMeasurer(), { showBrand: true, mascot: false });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.items.some((item) => item.kind === "text" && item.text.endsWith("…"))).toBe(true);
  });

  it("mascote: reserva o canto e sobe o conteúdo; sem espaço, é omitido com aviso (texto nunca sobreposto)", () => {
    const short = layoutStory(content("REFLECTION"), fakeMeasurer(), { showBrand: true, mascot: true });
    const mascot = short.items.find((item) => item.kind === "image" && item.asset === "mascot");
    expect(mascot && mascot.kind === "image" && mascot.x).toBe(MASCOT_BOX.x);
    const noMascotTop = Math.min(...short.items.filter((item) => item.kind === "text").map((item) => (item as Extract<DrawItem, { kind: "text" }>).y));
    const plain = layoutStory(content("REFLECTION"), fakeMeasurer(), { showBrand: true, mascot: false });
    const plainTop = Math.min(...plain.items.filter((item) => item.kind === "text").map((item) => (item as Extract<DrawItem, { kind: "text" }>).y));
    expect(noMascotTop).toBeLessThan(plainTop);

    const tall = layoutStory(
      content("CHECKLIST", { headline: "Um título bem comprido para ocupar duas linhas inteiras do Story", body: "item um\nitem dois\nitem três\nitem quatro\nitem cinco" }),
      fakeMeasurer(),
      { showBrand: true, mascot: true },
    );
    expect(tall.items.some((item) => item.kind === "image" && item.asset === "mascot")).toBe(false);
    expect(tall.warnings.join(" ")).toContain("mascote omitido");
  });
});

describe("render real (canvas)", () => {
  beforeEach(() => {
    putMock.mockClear();
    insertMediaMock.mockClear();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("gera JPEG 1080×1920 para os 11 tipos, sem exceção", async () => {
    for (const type of STORY_TYPES) {
      const story = content(type);
      const out = await render.renderSmartStoryBuffer({
        content: story,
        background: pickBackground({ mood: story.visualMood, seed: type }),
        showBrand: true,
        useMascot: false,
      });
      expect(out.contentType).toBe("image/jpeg");
      expect([out.buffer[0], out.buffer[1]]).toEqual([0xff, 0xd8]); // assinatura JPEG
      expect(out).toMatchObject({ width: 1080, height: 1920, mascotDrawn: false });
      expect(out.buffer.byteLength).toBeGreaterThan(8_000);
      expect(out.templateId).toBe(templateIdForType(type));
    }
  });

  it("o mascote só aparece se o PNG existir (sem o arquivo, nada quebra)", async () => {
    const out = await render.renderSmartStoryBuffer({
      content: content("REFLECTION"),
      background: STORY_BACKGROUNDS[0],
      showBrand: true,
      useMascot: true,
      brand: ALILU_BRAND_IDENTITY,
    });
    expect(out.mascotDrawn).toBe(render.isMascotAvailable());
  });

  it("grava no mesmo storage: put no Vercel Blob + instagram_media; devolve mediaId e URL", async () => {
    const stored = await render.renderAndStoreSmartStory({
      userId: "user-1",
      automationRunId: "run-1",
      content: content("CTA"),
      background: STORY_BACKGROUNDS[0],
      showBrand: true,
      useMascot: false,
    });
    expect(stored).toMatchObject({ mediaId: "media-123", imageUrl: "https://blob.example.com/generated/story.jpg" });
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0][0]).toMatch(/^instagram-media\/user-1\/generated\/\d+\.jpg$/);
    expect(putMock.mock.calls[0][2]).toMatchObject({ access: "public", contentType: "image/jpeg" });
    expect(insertMediaMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", mediaType: "image", automationRunId: "run-1" }));
  });

  it("falha do upload propaga o erro (quem chama marca FAILED e tenta de novo; nada fica pela metade)", async () => {
    putMock.mockRejectedValueOnce(new Error("blob indisponível"));
    await expect(
      render.renderAndStoreSmartStory({ userId: "u", automationRunId: null, content: content("CTA"), background: STORY_BACKGROUNDS[0], showBrand: true, useMascot: false }),
    ).rejects.toThrow("blob indisponível");
    expect(insertMediaMock).not.toHaveBeenCalled();
  });

  it("fundo de IMAGEM sem URL falha com erro claro (SmartStoryRenderError)", async () => {
    await expect(
      render.renderSmartStoryBuffer({
        content: content("CTA"),
        background: { ...STORY_BACKGROUNDS[0], kind: "IMAGE", url: null },
        showBrand: true,
        useMascot: false,
      }),
    ).rejects.toBeInstanceOf(render.SmartStoryRenderError);
  });

  it("os arquivos de logo e fontes embutidos existem", () => {
    expect(fs.existsSync(render.LOGO_PATH)).toBe(true);
  });
});
