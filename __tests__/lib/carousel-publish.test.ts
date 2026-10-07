// Carrossel Inteligente — Fase 5: publicar, agendar, rascunho, ZIP, histórico (PGlite).
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const publish = await import("@/lib/carousel/backend/carousel-publish-service");
const projects = await import("@/lib/carousel/backend/carousel-project-service");
const repo = await import("@/lib/carousel/backend/carousel-repository");
const { InstagramPublishError } = await import("@/lib/instagram/backend/instagram-publish-service");

const NOW = new Date("2026-10-07T12:00:00Z");
const FUTURE = "2099-01-01T12:00:00Z";

async function user(email: string): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function account(userId: string, n = "1", status = "connected"): Promise<string> {
  const [row] = await db.sql`
    insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted, status)
    values (${userId}, ${`ig-${n}-${userId}`}, ${`perfil${n}`}, 'x', ${status}) returning id`;
  return row.id as string;
}
async function readyProject(userId: string, count = 6, includeEndMedia = false) {
  const p = await projects.createCarouselProject({ userId, topic: "Tema do carrossel", slideCount: count, includeEndMedia, now: NOW });
  await projects.saveProjectSlides(userId, p.id, Array.from({ length: count }, (_, i) => ({ headline: `Slide ${i + 1}`, body: `Corpo ${i + 1}` })));
  await repo.updateProjectFields(userId, p.id, { caption: "Legenda pronta" });
  await repo.setProjectStatus(userId, p.id, "READY");
  return p;
}
const fakeRender = vi.fn(async (uid: string, input: { position: number }) => {
  const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${uid}, ${`https://x.blob.vercel-storage.com/s${input.position}-${Math.random()}.jpg`}, 'image', 10) returning id`;
  return { mediaId: row.id as string, url: "u", warnings: [], photoMissing: false };
});
const deps = (extra: Record<string, unknown> = {}) => ({ renderSlide: fakeRender, now: NOW, ...extra });

beforeEach(async () => {
  db = await createTestDb();
  fakeRender.mockClear();
});
afterEach(async () => {
  await db.close();
});

describe("publicar / agendar / rascunho", () => {
  it("rascunho: cria 1 post DRAFT com os slides na ordem e consome a cota", async () => {
    const u = await user("a@x.com");
    const acc = await account(u);
    const p = await readyProject(u);
    const out = await publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps());
    expect(out.outcome).toBe("SAVED_AS_DRAFT");
    const [post] = await db.sql`select status, caption, post_type, instagram_account_id from instagram_posts where id = ${out.postId}`;
    expect(post).toMatchObject({ status: "DRAFT", caption: "Legenda pronta", post_type: "carousel", instagram_account_id: acc });
    const items = await db.sql`select media_id, position, is_cover from instagram_post_items where post_id = ${out.postId} order by position`;
    const slides = await repo.listSlides(p.id);
    expect(items.map((i) => i.media_id)).toEqual(slides.map((s) => s.renderedMediaId));
    expect(items[0].is_cover).toBe(true);
    expect((await repo.getProject(u, p.id))?.completedAt).not.toBeNull();
  });

  it("repetir não duplica post (substitui o rascunho)", async () => {
    const u = await user("b@x.com");
    await account(u);
    const p = await readyProject(u);
    await publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps());
    await publish.publishCarousel(u, p.id, { mode: "DRAFT", caption: "Nova legenda" }, deps());
    const posts = await db.sql`select caption from instagram_posts where user_id = ${u}`;
    expect(posts).toHaveLength(1);
    expect(posts[0].caption).toBe("Nova legenda");
  });

  it("agendar: data futura OK, passada/ausente/sem fuso recusadas", async () => {
    const u = await user("c@x.com");
    await account(u);
    const p = await readyProject(u);
    await expect(publish.publishCarousel(u, p.id, { mode: "SCHEDULE" }, deps())).rejects.toMatchObject({ code: "INVALID" });
    await expect(publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: "2020-01-01T10:00:00Z" }, deps())).rejects.toMatchObject({ code: "INVALID" });
    await expect(publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: "2099-01-01T10:00" }, deps())).rejects.toMatchObject({ code: "INVALID" });
    expect(await db.sql`select 1 from instagram_posts`).toHaveLength(0);
    const out = await publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: FUTURE, timezone: "America/Sao_Paulo" }, deps());
    expect(out.project.status).toBe("SCHEDULED");
    const [post] = await db.sql`select status from instagram_posts where id = ${out.postId}`;
    expect(post.status).toBe("SCHEDULED");
  });

  it("desagendar volta para pronto e remove o post", async () => {
    const u = await user("d@x.com");
    await account(u);
    const p = await readyProject(u);
    await publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: FUTURE }, deps());
    const back = await publish.unscheduleCarousel(u, p.id);
    expect(back.status).toBe("READY");
    expect(back.instagramPostId).toBeNull();
    expect(await db.sql`select 1 from instagram_posts`).toHaveLength(0);
    await expect(publish.unscheduleCarousel(u, p.id)).rejects.toMatchObject({ code: "BAD_TRANSITION" });
  });

  it("publicar agora: sucesso marca PUBLISHED e bloqueia nova publicação", async () => {
    const u = await user("e@x.com");
    await account(u);
    const p = await readyProject(u);
    const publishFn = vi.fn(async (postId: string) => {
      await db.sql`update instagram_posts set status = 'PUBLISHED', published_at = now() where id = ${postId}`;
      return "PUBLISHED" as const;
    });
    const out = await publish.publishCarousel(u, p.id, { mode: "NOW" }, deps({ publish: publishFn }));
    expect(out.outcome).toBe("PUBLISHED");
    expect(out.project.status).toBe("PUBLISHED");
    await expect(publish.publishCarousel(u, p.id, { mode: "NOW" }, deps({ publish: publishFn }))).rejects.toMatchObject({ code: "BAD_TRANSITION" });
    expect(publishFn).toHaveBeenCalledTimes(1);
    await expect(publish.deleteCarousel(u, p.id)).rejects.toMatchObject({ code: "BAD_TRANSITION" });
  });

  it("publicar agora: erro da Meta mantém o carrossel pronto, com mensagem, e dá para tentar de novo", async () => {
    const u = await user("f@x.com");
    await account(u);
    const p = await readyProject(u);
    const failing = vi.fn(async () => {
      throw new InstagramPublishError("Token expirado");
    });
    await expect(publish.publishCarousel(u, p.id, { mode: "NOW" }, deps({ publish: failing }))).rejects.toMatchObject({ message: "Token expirado" });
    const after = await repo.getProject(u, p.id);
    expect(after?.status).toBe("READY");
    expect(after?.error).toBe("Token expirado");
    const retry = await publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps());
    expect(retry.outcome).toBe("SAVED_AS_DRAFT");
    expect(await db.sql`select 1 from instagram_posts`).toHaveLength(1);
  });

  it("exige conta conectada; várias contas exigem escolha; conta alheia/expirada é recusada", async () => {
    const u = await user("g@x.com");
    const p = await readyProject(u);
    await expect(publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps())).rejects.toMatchObject({ code: "INVALID" });
    const a1 = await account(u, "1");
    const a2 = await account(u, "2");
    await expect(publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps())).rejects.toMatchObject({ code: "INVALID" });
    const other = await user("h@x.com");
    const foreign = await account(other, "9");
    await expect(publish.publishCarousel(u, p.id, { mode: "DRAFT", accountId: foreign }, deps())).rejects.toBeTruthy();
    const ok = await publish.publishCarousel(u, p.id, { mode: "DRAFT", accountId: a2 }, deps());
    expect(ok.project.instagramAccountId).toBe(a2);
    expect(a1).not.toBe(a2);
    await db.sql`update instagram_accounts set status = 'expired' where id = ${a2}`;
    await expect(publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps())).rejects.toMatchObject({ code: "INVALID" });
  });

  it("outro usuário não publica carrossel alheio", async () => {
    const u = await user("i@x.com");
    await account(u);
    const p = await readyProject(u);
    const other = await user("j@x.com");
    await account(other);
    await expect(publish.publishCarousel(other, p.id, { mode: "DRAFT" }, deps())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(publish.exportCarouselZip(other, p.id, deps())).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(publish.deleteCarousel(other, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("imagem final padrão não configurada: publica sem ela e avisa", async () => {
    const u = await user("k@x.com");
    await account(u);
    const p = await readyProject(u, 6, true);
    const out = await publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps());
    expect(out.notice).toMatch(/não configurada/i);
    const items = await db.sql`select 1 from instagram_post_items where post_id = ${out.postId}`;
    expect(items).toHaveLength(6);
  });

  it("falha de render não cria post nem cobra", async () => {
    const u = await user("l@x.com");
    await account(u);
    const p = await readyProject(u);
    const broken = vi.fn(async () => {
      throw new Error("canvas");
    });
    await expect(publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps({ renderSlide: broken }))).rejects.toThrow();
    expect(await db.sql`select 1 from instagram_posts`).toHaveLength(0);
    expect((await repo.getProject(u, p.id))?.completedAt).toBeNull();
  });
});

describe("ZIP", () => {
  it("contém os slides na ordem e a legenda", async () => {
    const u = await user("m@x.com");
    const p = await readyProject(u);
    await repo.updateProjectFields(u, p.id, { hashtags: ["#a", "#b"] });
    const { filename, buffer } = await publish.exportCarouselZip(u, p.id, deps({ fetchImage: async (url: string) => Buffer.from(`img:${url}`) }));
    expect(filename).toBe("Tema-do-carrossel.zip");
    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(["legenda.txt", ...Array.from({ length: 6 }, (_, i) => `slide-0${i + 1}.jpg`)].sort());
    expect(await zip.file("legenda.txt")!.async("string")).toBe("Legenda pronta\n\n#a #b");
  });
  it("recusa URL que não seja do storage do Alilu", async () => {
    const u = await user("n@x.com");
    const p = await readyProject(u);
    const evil = vi.fn(async (uid: string, input: { position: number }) => {
      const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type, file_size_bytes) values (${uid}, ${`https://evil.com/${input.position}.jpg`}, 'image', 10) returning id`;
      return { mediaId: row.id as string, url: "u", warnings: [], photoMissing: false };
    });
    const fetchImage = vi.fn();
    await expect(publish.exportCarouselZip(u, p.id, deps({ renderSlide: evil, fetchImage }))).rejects.toMatchObject({ code: "INCOMPLETE" });
    expect(fetchImage).not.toHaveBeenCalled();
  });
});

describe("meus carrosséis", () => {
  it("lista só os do usuário, com capa, e filtra por status", async () => {
    const u = await user("o@x.com");
    await account(u);
    const p = await readyProject(u);
    await readyProject(u);
    await publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: FUTURE }, deps());
    const other = await user("p@x.com");
    await readyProject(other);
    const all = await publish.listMyCarousels(u);
    expect(all).toHaveLength(2);
    expect(all.find((c) => c.id === p.id)?.coverUrl).toMatch(/blob\.vercel-storage\.com/);
    expect(await publish.listMyCarousels(u, { status: "SCHEDULED" })).toHaveLength(1);
  });
  it("status acompanha o agendador (post publicado em segundo plano)", async () => {
    const u = await user("q@x.com");
    await account(u);
    const p = await readyProject(u);
    const out = await publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: FUTURE }, deps());
    await db.sql`update instagram_posts set status = 'PUBLISHED' where id = ${out.postId}`;
    expect((await publish.listMyCarousels(u))[0].status).toBe("PUBLISHED");
  });
  it("agendamento que falhou volta para pronto com aviso", async () => {
    const u = await user("r@x.com");
    await account(u);
    const p = await readyProject(u);
    const out = await publish.publishCarousel(u, p.id, { mode: "SCHEDULE", scheduledAt: FUTURE }, deps());
    await db.sql`update instagram_posts set status = 'FAILED' where id = ${out.postId}`;
    const [item] = await publish.listMyCarousels(u);
    expect(item.status).toBe("READY");
    expect(item.error).toMatch(/falhou/i);
  });
  it("duplicar cria um novo rascunho independente, sem artes e sem cota", async () => {
    const u = await user("s@x.com");
    await account(u);
    const p = await readyProject(u);
    await publish.publishCarousel(u, p.id, { mode: "DRAFT" }, deps());
    const copy = await publish.duplicateCarousel(u, p.id);
    expect(copy.id).not.toBe(p.id);
    expect(copy.completedAt).toBeNull();
    expect(copy.status).toBe("READY");
    expect(copy.caption).toBe("Legenda pronta");
    const slides = await repo.listSlides(copy.id);
    expect(slides).toHaveLength(6);
    expect(slides.every((s) => s.renderedMediaId === null)).toBe(true);
  });
  it("excluir remove o carrossel e seus slides", async () => {
    const u = await user("t@x.com");
    const p = await readyProject(u);
    await publish.deleteCarousel(u, p.id);
    expect(await repo.getProject(u, p.id)).toBeNull();
    expect(await db.sql`select 1 from carousel_slides where project_id = ${p.id}`).toHaveLength(0);
  });
});
