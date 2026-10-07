// Identidade por usuário nos Stories inteligentes: o Alilu só aparece para a
// conta do Alilu; as demais contas começam sem marca e usam a própria.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));
vi.mock("@vercel/blob", () => ({ put: vi.fn(), del: vi.fn(async () => undefined), issueSignedToken: vi.fn() }));
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const fakeProvider = { generatePost: vi.fn(), generateReel: vi.fn(), rewriteText: vi.fn() };
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({ getContentAIProvider: () => fakeProvider }));

import type { StoryBrand } from "@/lib/content-automation/smart-story/brand";
const brandLib = await import("@/lib/content-automation/smart-story/brand");
const { ALILU_BRAND_IDENTITY, NONE_BRAND, accentFor, normalizeHandle, normalizeSite, brandCanPromote } = brandLib;
const { pickCta, ctaPoolFor } = await import("@/lib/content-automation/smart-story/cta");
const { buildFallbackContent } = await import("@/lib/content-automation/smart-story/fallback");
const { buildStoryPrompt, typeInstruction } = await import("@/lib/content-automation/smart-story/prompts");
const { candidateTypes, pickMascot, planStory } = await import("@/lib/content-automation/smart-story/selection");
const { defaultSmartStoryConfig, normalizeSmartStoryConfig } = await import("@/lib/content-automation/smart-story/config");
const { STORY_TYPES } = await import("@/lib/content-automation/smart-story/types");
const { layoutStory } = await import("@/lib/content-automation/smart-story/render/layout");
const service = await import("@/lib/content-automation/backend/smart-story-brand-service");
const preview = await import("@/lib/content-automation/backend/smart-story-preview");
const brandRoute = await import("@/app/api/smart-story/brand/route");

const ANA: StoryBrand = { ...NONE_BRAND, kind: "CUSTOM", name: "Studio Ana", handle: "@studioana", site: "studioana.com.br" };
const ALILU_RE = /alilu/i;

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

describe("normalização da marca", () => {
  it("@ e site são normalizados; lixo vira null", () => {
    expect(normalizeHandle("  @@Studio.Ana ")).toBe("@studio.ana");
    expect(normalizeHandle("tem espaço")).toBeNull();
    expect(normalizeSite("https://www.StudioAna.com.br/")).toBe("studioana.com.br");
    expect(normalizeSite("não é site")).toBeNull();
    expect(brandCanPromote(NONE_BRAND)).toBe(false);
    expect(brandCanPromote({ ...NONE_BRAND, handle: "@a" })).toBe(true);
  });

  it("cor de destaque ilegível sobre o fundo é ignorada", () => {
    const custom = { ...ANA, accentColor: "#101010" };
    expect(accentFor(custom, "light", "#ffb457")).toBe("#ffb457"); // escuro demais sobre fundo escuro
    expect(accentFor({ ...ANA, accentColor: "#ffd166" }, "light", "#ffb457")).toBe("#ffd166");
    expect(accentFor({ ...ANA, accentColor: "#ffd166" }, "dark", "#7c2d12")).toBe("#7c2d12"); // claro demais sobre texto escuro
    expect(accentFor(NONE_BRAND, "light", "#abc")).toBe("#abc");
  });
});

describe("textos: nada do Alilu para quem não é o Alilu", () => {
  it("CTAs de uma marca própria usam o @ e o site dela", () => {
    const all = Object.values(ctaPoolFor(ANA)).flat().join(" | ");
    expect(all).toContain("@studioana");
    expect(all).toContain("studioana.com.br");
    expect(all).not.toMatch(ALILU_RE);
  });

  it("sem marca, nenhum CTA cita Alilu e 'visitar' cai para engajar", () => {
    for (const type of STORY_TYPES) {
      for (let i = 0; i < 20; i += 1) expect(pickCta(type, `s${i}`, [])).not.toMatch(ALILU_RE);
    }
    expect(ctaPoolFor(NONE_BRAND).visit).toEqual([]);
  });

  it("o Alilu mantém os CTAs de sempre", () => {
    const all = Object.values(ctaPoolFor(ALILU_BRAND_IDENTITY)).flat().join(" ");
    expect(all).toContain("alilu.com.br");
    expect(all).toContain("@alilu.tec");
  });

  it("prompt e fallback de marca própria não mencionam Alilu", () => {
    const config = defaultSmartStoryConfig();
    for (const type of ["CTA", "ALILU_BRAND"] as const) {
      expect(typeInstruction(type, ANA)).not.toMatch(ALILU_RE);
      expect(typeInstruction(type, ANA)).toContain("Studio Ana");
      const content = buildFallbackContent(type, "seed", [], ANA);
      expect(`${content.headline} ${content.body} ${content.cta}`).not.toMatch(ALILU_RE);
      const plan = planStory({ seed: "p", time: "20:00", config, history: [], brand: ANA });
      expect(buildStoryPrompt({ plan: { ...plan, type }, basePrompt: "", brandContext: "Estúdio de pilates", history: [], brand: ANA })).not.toMatch(ALILU_RE);
    }
    // sem marca nenhuma o fallback de convite vira texto genérico, sem Alilu
    const bare = buildFallbackContent("CTA", "seed", [], NONE_BRAND);
    expect(`${bare.headline} ${bare.cta}`).not.toMatch(ALILU_RE);
    // Alilu conserva o texto curado
    expect(buildFallbackContent("CTA", "seed", [], ALILU_BRAND_IDENTITY).headline).toMatch(/Ferramentas|Calculadoras/);
  });
});

describe("seleção", () => {
  it("sem @ nem site os tipos de convite nunca são sorteados", () => {
    const config = defaultSmartStoryConfig();
    for (const time of ["07:00", "12:00", "20:00", "23:00"]) {
      const types = candidateTypes({ time, config, history: [], brand: NONE_BRAND });
      expect(types).not.toContain("CTA");
      expect(types).not.toContain("ALILU_BRAND");
    }
    for (let i = 0; i < 200; i += 1) {
      const type = planStory({ seed: `n${i}`, time: "20:00", config, history: [], brand: NONE_BRAND }).type;
      expect(["CTA", "ALILU_BRAND"]).not.toContain(type);
    }
    const onlyInvite = normalizeSmartStoryConfig({ enabledTypes: ["CTA", "ALILU_BRAND"] });
    expect(candidateTypes({ time: "20:00", config: onlyInvite, history: [], brand: NONE_BRAND })).toEqual(["REFLECTION"]);
  });

  it("com @ ou site próprio, os tipos de convite voltam a ser sorteados", () => {
    const config = defaultSmartStoryConfig();
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) seen.add(planStory({ seed: `c${i}`, time: "20:00", config, history: [], brand: ANA }).type);
    expect(seen.has("CTA") || seen.has("ALILU_BRAND")).toBe(true);
  });

  it("mascote só existe se a marca tem mascote próprio", () => {
    const config = normalizeSmartStoryConfig({ mascotEveryN: 2 });
    const hits = (brand: StoryBrand) => Array.from({ length: 300 }, (_, i) => pickMascot(`m${i}`, config, [], brand)).filter(Boolean).length;
    expect(hits(NONE_BRAND)).toBe(0);
    expect(hits({ ...ANA, logoUrl: "https://x.blob.vercel-storage.com/l.png" })).toBe(0);
    expect(hits({ ...ANA, mascotUrl: "https://x.blob.vercel-storage.com/m.png" })).toBeGreaterThan(0);
    expect(hits(ALILU_BRAND_IDENTITY)).toBeGreaterThan(0);
  });
});

describe("layout com e sem marca", () => {
  const story = buildFallbackContent("REFLECTION", "s", []);
  const logos = (items: ReturnType<typeof layoutStory>["items"]) => items.filter((item) => item.kind === "image" && item.asset === "logo");
  const handleTexts = (items: ReturnType<typeof layoutStory>["items"], text: string) => items.filter((item) => item.kind === "text" && item.text === text);

  it("sem marca: nenhum logo nem @, mesmo com 'mostrar marca' ligado", () => {
    const { items } = layoutStory(story, fakeMeasurer(), { showBrand: true, mascot: false });
    expect(items.some((item) => item.kind === "image")).toBe(false);
    expect(handleTexts(items, "@alilu.tec")).toHaveLength(0);
  });

  it("só @, só logo ou os dois", () => {
    expect(logos(layoutStory(story, fakeMeasurer(), { showBrand: true, mascot: false, brandHandle: "@studioana" }).items)).toHaveLength(0);
    expect(handleTexts(layoutStory(story, fakeMeasurer(), { showBrand: true, mascot: false, brandHandle: "@studioana" }).items, "@studioana")).toHaveLength(1);
    expect(logos(layoutStory(story, fakeMeasurer(), { showBrand: true, mascot: false, hasLogo: true }).items)).toHaveLength(1);
    const both = layoutStory(story, fakeMeasurer(), { showBrand: true, mascot: false, hasLogo: true, brandHandle: "@studioana" }).items;
    expect(logos(both)).toHaveLength(1);
    expect(handleTexts(both, "@studioana")).toHaveLength(1);
    expect(handleTexts(layoutStory(story, fakeMeasurer(), { showBrand: false, mascot: false, hasLogo: true, brandHandle: "@studioana" }).items, "@studioana")).toHaveLength(0);
  });

  it("template de convite sem logo não reserva logo grande", () => {
    const cta = buildFallbackContent("CTA", "s", [], ANA);
    expect(logos(layoutStory(cta, fakeMeasurer(), { showBrand: true, mascot: false, brandHandle: "@studioana" }).items)).toHaveLength(0);
    expect(logos(layoutStory(cta, fakeMeasurer(), { showBrand: true, mascot: false, brandHandle: "@studioana", hasLogo: true }).items)).toHaveLength(1);
  });
});

describe("render real: sem marca não desenha o Alilu", () => {
  it("a arte do Alilu difere da arte sem marca; sem marca renderiza todos os tipos", async () => {
    vi.doMock("@/lib/instagram/backend/template-render-service", () => ({ storeGeneratedAutomationJpeg: vi.fn() }));
    const render = await import("@/lib/content-automation/smart-story/render/render-service");
    const { pickBackground } = await import("@/lib/content-automation/smart-story/render/backgrounds");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const story = buildFallbackContent("REFLECTION", "s", []);
    const background = pickBackground({ mood: story.visualMood, seed: "x" });
    const none = await render.renderSmartStoryBuffer({ content: story, background, showBrand: true, useMascot: true, brand: NONE_BRAND });
    const alilu = await render.renderSmartStoryBuffer({ content: story, background, showBrand: true, useMascot: false, brand: ALILU_BRAND_IDENTITY });
    expect(none.mascotDrawn).toBe(false);
    expect(Buffer.compare(none.buffer, alilu.buffer)).not.toBe(0);
    for (const type of STORY_TYPES) {
      const content = buildFallbackContent(type, "t", [], NONE_BRAND);
      const out = await render.renderSmartStoryBuffer({ content, background, showBrand: true, useMascot: false });
      expect([out.buffer[0], out.buffer[1]]).toEqual([0xff, 0xd8]);
    }
    // URL de logo que não é do Blob é ignorada (nunca buscamos URL arbitrária) e nada quebra
    const hostile = await render.renderSmartStoryBuffer({
      content: story,
      background,
      showBrand: true,
      useMascot: true,
      brand: { ...ANA, logoUrl: "https://evil.example.com/logo.png", mascotUrl: "http://169.254.169.254/x.png" },
    });
    expect(hostile.mascotDrawn).toBe(false);
  });
});

describe("resolveStoryBrand + salvar identidade (banco)", () => {
  const original = process.env.ADMIN_EMAILS;
  beforeEach(async () => {
    db = await createTestDb();
    process.env.ADMIN_EMAILS = "admin@alilu.test";
  });
  afterEach(async () => {
    process.env.ADMIN_EMAILS = original;
    await db.close();
    vi.clearAllMocks();
  });

  async function user(email: string) {
    const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
    return row.id as string;
  }

  it("conta comum sem perfil = sem marca; admin sem perfil = Alilu", async () => {
    expect((await service.resolveStoryBrand(await user("ana@example.com"))).kind).toBe("NONE");
    const admin = await service.resolveStoryBrand(await user("admin@alilu.test"));
    expect(admin).toMatchObject({ kind: "ALILU", handle: "@alilu.tec" });
  });

  it("perfil preenchido vira marca própria (inclusive para o admin) e limpar volta ao padrão", async () => {
    const ana = await user("ana@example.com");
    await service.saveStoryBrandTexts(ana, { brandName: " Studio Ana ", handle: "@@StudioAna", site: "https://www.studioana.com.br/", accentColor: "#FFD166" });
    expect(await service.resolveStoryBrand(ana)).toMatchObject({ kind: "CUSTOM", name: "Studio Ana", handle: "@studioana", site: "studioana.com.br", accentColor: "#ffd166", logoUrl: null, mascotUrl: null });
    const admin = await user("admin@alilu.test");
    await service.saveStoryBrandTexts(admin, { handle: "@outra.marca" });
    expect(await service.resolveStoryBrand(admin)).toMatchObject({ kind: "CUSTOM", handle: "@outra.marca" });
    await service.saveStoryBrandTexts(admin, {});
    expect((await service.resolveStoryBrand(admin)).kind).toBe("ALILU");
  });

  it("dados inválidos são recusados (nunca viram vazio em silêncio) e o perfil de um usuário não vaza para outro", async () => {
    const ana = await user("ana@example.com");
    const bia = await user("bia@example.com");
    await expect(service.saveStoryBrandTexts(ana, { handle: "com espaço", site: "x", accentColor: "azul" })).rejects.toBeInstanceOf(service.StoryBrandValidationError);
    await service.saveStoryBrandTexts(ana, { handle: "@ana" });
    expect((await service.resolveStoryBrand(bia)).kind).toBe("NONE");
  });

  it("upload só é aceito do próprio prefixo no Blob", () => {
    const own = "https://abc.public.blob.vercel-storage.com/smart-story-brand/u1/logo-upload.png";
    expect(() => service.assertOwnBrandUpload("u1", own)).not.toThrow();
    expect(() => service.assertOwnBrandUpload("u2", own)).toThrow();
    expect(() => service.assertOwnBrandUpload("u1", "https://evil.example.com/smart-story-brand/u1/x.png")).toThrow();
    expect(() => service.assertOwnBrandUpload("u1", "http://abc.public.blob.vercel-storage.com/smart-story-brand/u1/x.png")).toThrow();
    expect(() => service.assertOwnBrandUpload("u1", "https://abc.public.blob.vercel-storage.com/smart-story-brand/u1/../u2/x.png")).toThrow();
  });

  it("falha do banco nunca derruba o Story: cai em sem marca", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await db.close();
    db = { ...db, sql: async () => { throw new Error("db fora"); } } as TestDb;
    expect((await service.resolveStoryBrand("qualquer")).kind).toBe("NONE");
    db = await createTestDb();
  });

  it("prévia: conta comum sem marca nunca recebe convite/Alilu; com @ recebe convite da própria marca", async () => {
    const seed = await seedUserWithAccount(db, "9");
    const userId = seed.userId as string;
    const failAi = async () => {
      throw new Error("x");
    };
    const onlyInvite = { enabledTypes: ["CTA", "ALILU_BRAND", "REFLECTION"], typeWeights: { CTA: 100, ALILU_BRAND: 100, REFLECTION: 1 } };
    const base = { rawConfig: onlyInvite, basePrompt: "", brandContext: "", time: "20:00", userId, callAi: failAi };
    for (let i = 0; i < 15; i += 1) {
      const result = await preview.buildSmartStoryPreview({ ...base, nonce: `n${i}` });
      expect(["CTA", "ALILU_BRAND"]).not.toContain(result.plan.type);
      expect(`${result.content.headline} ${result.content.cta}`).not.toMatch(ALILU_RE);
    }
    await service.saveStoryBrandTexts(userId, { brandName: "Studio Ana", handle: "@studioana", site: "studioana.com.br" });
    const types = new Set<string>();
    for (let i = 0; i < 15; i += 1) {
      const result = await preview.buildSmartStoryPreview({ ...base, nonce: `m${i}` });
      types.add(result.plan.type);
      expect(`${result.content.headline} ${result.content.cta}`).not.toMatch(ALILU_RE);
    }
    expect([...types].some((type) => type === "CTA" || type === "ALILU_BRAND")).toBe(true);
  });
});

describe("rota /api/smart-story/brand", () => {
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(async () => {
    await db.close();
    vi.clearAllMocks();
  });

  it("exige login; salva e devolve a identidade; recusa dado inválido", async () => {
    authMock.mockResolvedValue(null);
    expect((await brandRoute.GET()).status).toBe(401);
    const [row] = await db.sql`insert into users (email) values ('ana@example.com') returning id`;
    authMock.mockResolvedValue({ user: { id: row.id, email: "ana@example.com" } });
    const put = (body: unknown) => brandRoute.PUT(new Request("http://x/api/smart-story/brand", { method: "PUT", body: JSON.stringify(body) }));
    const ok = await put({ handle: "@studioana", site: "studioana.com.br" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ handle: "@studioana", effectiveKind: "CUSTOM" });
    expect((await put({ handle: "inválido!!" })).status).toBe(400);
    const got = await (await brandRoute.GET()).json();
    expect(got).toMatchObject({ handle: "@studioana", site: "studioana.com.br" });
  });
});
