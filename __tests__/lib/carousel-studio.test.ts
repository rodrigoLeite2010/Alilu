// Carrossel Inteligente — Fase 4: templates, layout puro, render, fotos e editor (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { CAROUSEL_TEMPLATES, contrastRatio, getCarouselTemplate, resolvePalette, readableOn } from "@/lib/carousel/design/templates";
import { layoutCarouselSlide, CONTENT_WIDTH, MARGIN } from "@/lib/carousel/design/layout";
import { parsePexelsPhotos, isAllowedPhotoUrl } from "@/lib/carousel/photos/photo-provider";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const studio = await import("@/lib/carousel/backend/carousel-studio-service");
const projects = await import("@/lib/carousel/backend/carousel-project-service");
const repo = await import("@/lib/carousel/backend/carousel-repository");
const renderer = await import("@/lib/carousel/render/carousel-render-service");

const NOW = new Date("2026-10-07T12:00:00Z");

// Medidor falso: largura proporcional ao nº de caracteres.
function measurer() {
  const state = { font: "10px x" };
  return {
    get font() {
      return state.font;
    },
    set font(value: string) {
      state.font = value;
    },
    measureText(text: string) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(state.font)?.[1] ?? 10);
      return { width: text.length * px * 0.55 };
    },
  };
}

describe("templates e paleta", () => {
  it("todos os templates têm texto legível sobre o fundo", () => {
    for (const template of CAROUSEL_TEMPLATES) {
      expect(contrastRatio(template.text, template.background[0])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(template.accent, template.background[0])).toBeGreaterThanOrEqual(3);
    }
  });
  it("ids únicos e fallback para o padrão", () => {
    expect(new Set(CAROUSEL_TEMPLATES.map((t) => t.id)).size).toBe(CAROUSEL_TEMPLATES.length);
    expect(getCarouselTemplate("nao-existe").id).toBe(CAROUSEL_TEMPLATES[0].id);
  });
  it("cor da marca só vale com contraste mínimo", () => {
    const petroleo = getCarouselTemplate("alilu-petroleo");
    expect(resolvePalette(petroleo, { brandAccent: "#ff5a36" }).accent).toBe("#ff5a36");
    expect(resolvePalette(petroleo, { brandAccent: "#0c3b4b" }).accent).toBe(petroleo.accent); // quase igual ao fundo
    expect(resolvePalette(petroleo, { brandAccent: "vermelho" }).accent).toBe(petroleo.accent);
  });
  it("com foto, texto sempre claro", () => {
    const areia = getCarouselTemplate("alilu-areia");
    const palette = resolvePalette(areia, { hasPhoto: true });
    expect(palette.text).toBe("#ffffff");
    expect(palette.tone).toBe("light");
  });
  it("readableOn escolhe branco ou preto", () => {
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableOn("#ffd23f")).toBe("#111111");
  });
});

describe("layout do slide", () => {
  const base = { total: 10, handle: null, hasLogo: false, hasPhoto: false, template: getCarouselTemplate("alilu-petroleo"), cta: "" };
  it("nada passa da área segura", () => {
    const { items } = layoutCarouselSlide(measurer(), { ...base, position: 4, headline: "Um título razoavelmente longo para o slide de teste do layout", body: "Texto de apoio ".repeat(14) });
    for (const item of items) {
      if (item.kind === "text" && item.align === "left") expect(item.x).toBeGreaterThanOrEqual(MARGIN.left);
      if (item.kind === "text") expect(item.y).toBeLessThan(1350);
    }
    const texts = items.filter((item) => item.kind === "text");
    expect(texts.length).toBeGreaterThan(2);
  });
  it("título e corpo ficam dentro da largura", () => {
    const m = measurer();
    const { items } = layoutCarouselSlide(m, { ...base, position: 2, headline: "Palavra ".repeat(20), body: "Detalhe ".repeat(30) });
    for (const item of items) {
      if (item.kind !== "text" || item.text.includes("/") || item.text.startsWith("@")) continue;
      m.font = `${item.bold ? "bold " : ""}${item.fontPx}px ${item.family}`;
      expect(m.measureText(item.text).width).toBeLessThanOrEqual(CONTENT_WIDTH + 1);
    }
  });
  it("capa sem @ não mostra numeração; slides internos mostram", () => {
    const cover = layoutCarouselSlide(measurer(), { ...base, position: 1, headline: "Capa", body: "" });
    expect(cover.items.some((item) => item.kind === "text" && item.text === "01/10")).toBe(false);
    expect(cover.items.some((item) => item.kind === "text" && item.text.startsWith("arraste"))).toBe(true);
    const inner = layoutCarouselSlide(measurer(), { ...base, position: 3, headline: "Meio", body: "" });
    expect(inner.items.some((item) => item.kind === "text" && item.text === "03/10")).toBe(true);
  });
  it("CTA só no último slide e como pílula", () => {
    const last = layoutCarouselSlide(measurer(), { ...base, position: 10, headline: "Fim", body: "ok", cta: "Salve este post" });
    expect(last.items.some((item) => item.kind === "text" && item.text === "Salve este post" && item.color === "onAccent")).toBe(true);
    const mid = layoutCarouselSlide(measurer(), { ...base, position: 5, headline: "Meio", body: "ok", cta: "Salve este post" });
    expect(mid.items.some((item) => item.kind === "text" && item.text === "Salve este post")).toBe(false);
  });
  it("barra de progresso tem um segmento por slide", () => {
    const { items } = layoutCarouselSlide(measurer(), { ...base, total: 7, position: 3, headline: "x", body: "" });
    const segments = items.filter((item) => item.kind === "roundRect" && item.h === 8);
    expect(segments).toHaveLength(7);
    expect(segments.filter((s) => s.kind === "roundRect" && s.alpha === 1)).toHaveLength(3);
  });
  it("texto enorme é encolhido/cortado com aviso, nunca estoura", () => {
    const { items, warnings } = layoutCarouselSlide(measurer(), { ...base, position: 2, headline: "Muito ".repeat(200), body: "Mais ".repeat(400) });
    expect(warnings.length).toBeGreaterThan(0);
    expect(items.every((item) => item.kind !== "text" || item.y < 1350)).toBe(true);
  });
  it("com foto o bloco de texto fica na metade de baixo", () => {
    const { items } = layoutCarouselSlide(measurer(), { ...base, hasPhoto: true, position: 2, headline: "Título curto", body: "Corpo curto" });
    const title = items.find((item) => item.kind === "text" && item.text === "Título curto");
    expect(title && title.kind === "text" && title.y).toBeGreaterThan(700);
  });
});

describe("banco de fotos", () => {
  it("só aceita imagens do host permitido", () => {
    expect(isAllowedPhotoUrl("https://images.pexels.com/photos/1/a.jpeg")).toBe(true);
    for (const bad of ["http://images.pexels.com/a.jpg", "https://evil.com/a.jpg", "https://images.pexels.com.evil.com/a.jpg", "javascript:alert(1)", 42]) {
      expect(isAllowedPhotoUrl(bad)).toBe(false);
    }
  });
  it("interpreta a resposta do Pexels e descarta fotos de host estranho", () => {
    const photos = parsePexelsPhotos({
      photos: [
        { id: 1, width: 100, height: 200, photographer: "Ana", photographer_url: "https://www.pexels.com/@ana", url: "https://www.pexels.com/photo/1", src: { large2x: "https://images.pexels.com/photos/1/big.jpeg", medium: "https://images.pexels.com/photos/1/m.jpeg" } },
        { id: 2, src: { large2x: "https://evil.com/x.jpg", medium: "https://evil.com/x.jpg" } },
      ],
    });
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ id: "1", author: "Ana", provider: "pexels" });
  });
});

describe("render real (canvas)", () => {
  it("gera JPEG 1080x1350", async () => {
    const out = await renderer.renderCarouselSlideBuffer({
      position: 1, total: 10, headline: "Teste de renderização do carrossel", body: "Subtítulo", cta: "", templateId: "alilu-areia", photoUrl: null,
      brand: { handle: "@studio", accentColor: "#c4572f", logoUrl: null, useAliluLogo: false },
    });
    expect(out.buffer[0]).toBe(0xff);
    expect(out.buffer[1]).toBe(0xd8);
    expect(out.width).toBe(1080);
    expect(out.height).toBe(1350);
    expect(out.buffer.byteLength).toBeGreaterThan(8000);
    expect(out.photoMissing).toBe(false);
  });
  it("foto de host não permitido não é baixada e o slide sai só com o template", async () => {
    const out = await renderer.renderCarouselSlideBuffer({
      position: 2, total: 5, headline: "Sem foto", body: "", cta: "", templateId: null, photoUrl: "https://evil.com/a.jpg",
      brand: { handle: null, accentColor: null, logoUrl: null, useAliluLogo: false },
    });
    expect(out.photoMissing).toBe(true);
    expect(out.buffer.byteLength).toBeGreaterThan(8000);
  });
});

// ---------------------------------------------------------------------------
async function user(email: string): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function project(userId: string, count = 6, over: { includeEndMedia?: boolean } = {}) {
  const p = await projects.createCarouselProject({ userId, topic: "Tema", slideCount: count, includeEndMedia: over.includeEndMedia ?? false, now: NOW });
  await projects.saveProjectSlides(userId, p.id, Array.from({ length: count }, (_, i) => ({ headline: `Slide ${i + 1}`, body: `Corpo ${i + 1}`, visualKind: i === 1 ? "PHOTO" : "GRAPHIC", imageQuery: i === 1 ? "desk" : null })));
  return p;
}
const fakeRender = vi.fn(async (uid: string, input: { position: number }) => {
  const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${uid}, ${`https://x.blob.vercel-storage.com/s${input.position}-${Math.random()}.jpg`}, 'image', 10) returning id`;
  return { mediaId: row.id as string, url: "u", warnings: [], photoMissing: false };
});
const photo = (id: string) => ({ provider: "pexels", id, url: `https://images.pexels.com/photos/${id}/a.jpeg`, thumbUrl: `https://images.pexels.com/photos/${id}/m.jpeg`, width: 1, height: 1, author: "A", authorUrl: null, sourceUrl: null });

beforeEach(async () => {
  db = await createTestDb();
  fakeRender.mockClear();
});
afterEach(async () => {
  await db.close();
});

describe("editor", () => {
  it("edita texto com normalização e invalida a arte", async () => {
    const u = await user("a@x.com");
    const p = await project(u);
    await studio.renderProjectSlides(u, p.id, { renderSlide: fakeRender });
    const updated = await studio.editSlide(u, p.id, 2, { headline: "  Novo   título  ", body: "x".repeat(400) });
    expect(updated.headline).toBe("Novo título");
    expect(updated.body.length).toBeLessThanOrEqual(220);
    expect(updated.renderedMediaId).toBeNull();
    const others = (await repo.listSlides(p.id)).filter((s) => s.position !== 2);
    expect(others.every((s) => s.renderedMediaId)).toBe(true);
  });
  it("recusa título vazio, visual inválido e template inválido", async () => {
    const u = await user("b@x.com");
    const p = await project(u);
    await expect(studio.editSlide(u, p.id, 1, { headline: "   " })).rejects.toMatchObject({ code: "INVALID" });
    await expect(studio.editSlide(u, p.id, 1, { visualKind: "IMAGE_AI" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(studio.editSlide(u, p.id, 1, { templateId: "../../etc" })).rejects.toMatchObject({ code: "INVALID" });
  });
  it("isolamento entre usuários", async () => {
    const u = await user("c@x.com");
    const p = await project(u);
    const other = await user("d@x.com");
    await expect(studio.editSlide(other, p.id, 1, { headline: "invasão" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(studio.moveSlide(other, p.id, 1, 2)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(studio.renderProjectSlides(other, p.id, { renderSlide: fakeRender })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("mover slide mantém conteúdo, foto e recalcula papéis", async () => {
    const u = await user("e@x.com");
    const p = await project(u);
    await studio.choosePhoto(u, p.id, 2, photo("7"));
    const moved = await studio.moveSlide(u, p.id, 2, 5);
    expect(moved.map((s) => s.headline)).toEqual(["Slide 1", "Slide 3", "Slide 4", "Slide 5", "Slide 2", "Slide 6"]);
    expect(moved[4].style.photo).toMatchObject({ id: "7" });
    expect(moved.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(moved[0].role).toBe("HOOK");
    expect(moved[5].role).toBe("CTA");
  });
  it("duplicar respeita o máximo (10, ou 9 com imagem final)", async () => {
    const u = await user("f@x.com");
    const p = await project(u, 9, { includeEndMedia: true });
    await expect(studio.duplicateSlide(u, p.id, 3)).rejects.toMatchObject({ code: "INVALID" });
    const q = await project(u, 9);
    const dup = await studio.duplicateSlide(u, q.id, 3);
    expect(dup).toHaveLength(10);
    expect((await repo.getProject(u, q.id))?.slideCount).toBe(10);
  });
  it("remover respeita mínimo 5 e protege a capa", async () => {
    const u = await user("g@x.com");
    const p = await project(u, 6);
    await expect(studio.deleteSlide(u, p.id, 1)).rejects.toMatchObject({ code: "INVALID" });
    const after = await studio.deleteSlide(u, p.id, 3);
    expect(after).toHaveLength(5);
    await expect(studio.deleteSlide(u, p.id, 3)).rejects.toMatchObject({ code: "INVALID" });
  });
  it("adicionar slide depois de uma posição", async () => {
    const u = await user("h@x.com");
    const p = await project(u, 6);
    const list = await studio.addSlide(u, p.id, 2, { headline: "Extra", body: "novo" });
    expect(list).toHaveLength(7);
    expect(list[2].headline).toBe("Extra");
  });
  it("template do projeto invalida todas as artes", async () => {
    const u = await user("i@x.com");
    const p = await project(u);
    await studio.renderProjectSlides(u, p.id, { renderSlide: fakeRender });
    await studio.setProjectTemplate(u, p.id, "alilu-noite");
    expect((await repo.listSlides(p.id)).every((s) => s.renderedMediaId === null)).toBe(true);
    await expect(studio.setProjectTemplate(u, p.id, "x")).rejects.toMatchObject({ code: "INVALID" });
  });
});

describe("fotos no editor", () => {
  it("escolhe foto do banco e recusa host estranho", async () => {
    const u = await user("j@x.com");
    const p = await project(u);
    const s = await studio.choosePhoto(u, p.id, 3, photo("9"));
    expect(s.visualKind).toBe("PHOTO");
    await expect(studio.choosePhoto(u, p.id, 3, { ...photo("9"), url: "https://evil.com/a.jpg" })).rejects.toMatchObject({ code: "INVALID" });
  });
  it("auto-atribui fotos sem repetir; sem provedor, avisa quais ficaram sem", async () => {
    const u = await user("k@x.com");
    const p = await project(u);
    await studio.editSlide(u, p.id, 4, { visualKind: "PHOTO", imageQuery: "plan" });
    const provider = { id: "fake", search: vi.fn(async () => [photo("1"), photo("2")]) };
    const result = await studio.autoAssignPhotos(u, p.id, { photos: provider });
    expect(result).toMatchObject({ assigned: 2, providerAvailable: true, missing: [] });
    const ids = (await repo.listSlides(p.id)).map((s) => (s.style.photo as { id?: string } | undefined)?.id).filter(Boolean);
    expect(new Set(ids).size).toBe(2);
    const q = await project(u);
    expect(await studio.autoAssignPhotos(u, q.id, { photos: null })).toEqual({ assigned: 0, missing: [2], providerAvailable: false });
  });
  it("usa imagem própria só se for do usuário", async () => {
    const u = await user("l@x.com");
    const p = await project(u);
    const [mine] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${u}, 'https://a.blob.vercel-storage.com/m.jpg', 'image', 10) returning id`;
    const s = await studio.useOwnImage(u, p.id, 2, mine.id as string);
    expect(s.imageMediaId).toBe(mine.id);
    const other = await user("m@x.com");
    const [theirs] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${other}, 'https://a.blob.vercel-storage.com/n.jpg', 'image', 10) returning id`;
    await expect(studio.useOwnImage(u, p.id, 2, theirs.id as string)).rejects.toMatchObject({ code: "INVALID" });
  });
  it("remover imagem volta para gráfico", async () => {
    const u = await user("n@x.com");
    const p = await project(u);
    await studio.choosePhoto(u, p.id, 2, photo("3"));
    const s = await studio.removeSlideImage(u, p.id, 2);
    expect(s.visualKind).toBe("GRAPHIC");
    expect(s.style.photo).toBeUndefined();
  });
});

describe("render e conclusão", () => {
  it("renderiza só o que falta e reaproveita o resto", async () => {
    const u = await user("o@x.com");
    const p = await project(u);
    const first = await studio.renderProjectSlides(u, p.id, { renderSlide: fakeRender });
    expect(first.rendered).toBe(6);
    const second = await studio.renderProjectSlides(u, p.id, { renderSlide: fakeRender });
    expect(second).toMatchObject({ rendered: 0, skipped: 6 });
    const forced = await studio.renderProjectSlides(u, p.id, { renderSlide: fakeRender, force: true });
    expect(forced.rendered).toBe(6);
  });
  it("finalizar consome UMA cota (idempotente)", async () => {
    const u = await user("p@x.com");
    const p = await project(u);
    const done = await studio.finalizeCarousel(u, p.id, { renderSlide: fakeRender, now: NOW });
    expect(done.counted).toBe(true);
    const again = await studio.finalizeCarousel(u, p.id, { renderSlide: fakeRender, now: NOW });
    expect(again.counted).toBe(false);
    expect((await db.sql`select count(*)::int as n from plan_usage_events`)[0].n).toBe(0); // grátis: só o trial
    const [trial] = await db.sql`select count(*)::int as n from carousel_trial_claims`;
    expect(trial.n).toBe(1);
  });
  it("falha no render → nada é cobrado", async () => {
    const u = await user("q@x.com");
    const p = await project(u);
    const broken = vi.fn(async () => {
      throw new Error("canvas");
    });
    await expect(studio.finalizeCarousel(u, p.id, { renderSlide: broken, now: NOW })).rejects.toThrow();
    expect((await repo.getProject(u, p.id))?.completedAt).toBeNull();
    expect((await db.sql`select count(*)::int as n from carousel_trial_claims`)[0].n).toBe(0);
  });
  it("usa a marca do usuário e o logo Alilu só para admin", async () => {
    const u = await user("r@x.com");
    await repo.saveCarouselBrand(u, { brandName: "Studio", handle: "@studio.ana", niche: null, audience: null, objective: null, tone: null, accentColor: "#ff5a36", secondaryColor: null, fontId: null, defaultTemplateId: null, logoUrl: null });
    const p = await project(u);
    await studio.renderProjectSlides(u, p.id, { renderSlide: fakeRender });
    const inputs = fakeRender.mock.calls.map((call) => (call as unknown as [string, { brand: { handle: string | null; useAliluLogo: boolean; accentColor: string | null } }])[1].brand);
    expect(inputs[0]).toMatchObject({ handle: "@studio.ana", useAliluLogo: false, accentColor: "#ff5a36" });
  });
});
