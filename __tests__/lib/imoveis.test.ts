// @vitest-environment node
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import {
  EMPTY_PROPERTY,
  parseProperty,
  parseFilters,
} from "@/lib/imoveis/model";
let db: TestDb;
let sql: TestDb["sql"] & {
  query: (text: string, args: unknown[]) => Promise<Record<string, unknown>[]>;
};
let user: string, other: string;
const session = vi.hoisted(() => ({
  user: { id: "", email: "owner@example.com" },
}));
vi.mock("@/lib/db/client", () => ({ getDb: () => sql }));
vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/admin/admin-access", () => ({
  getAdminSession: async () => null,
}));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (path: string) => ({
    url: `https://test.public.blob.vercel-storage.com/${path}`,
  })),
  del: vi.fn(async () => {}),
  list: vi.fn(async () => ({ blobs: [], hasMore: false })),
}));
const repo = await import("@/lib/imoveis/repository");
const images = await import("@/lib/imoveis/images");
const api = await import("@/app/api/imoveis/[[...path]]/route");
const { checkOrigin } = await import("@/lib/imoveis/http");
beforeAll(async () => {
  process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
    "base64",
  );
  db = await createTestDb();
  sql = Object.assign(db.sql, {
    query: async (text: string, args: unknown[]) =>
      (await db.pg.query<Record<string, unknown>>(text, args)).rows,
  });
}, 30000);
beforeEach(async () => {
  vi.unstubAllGlobals();
  await db.pg.exec(
    "truncate property_images,property_history,property_reports,property_favorites,properties,property_advertisers,property_rate_limits,users cascade",
  );
  await db.sql`update property_settings set config=jsonb_set(config,'{maxListings}','10') where id=1`;
  const rows =
    await db.sql`insert into users(email) values('a@example.com'),('b@example.com') returning id`;
  user = rows[0].id as string;
  other = rows[1].id as string;
  session.user.id = user;
});
afterAll(async () => {
  await db?.close();
  vi.unstubAllEnvs();
});
async function photo(owner = user) {
  const id = randomUUID();
  await db.sql`insert into property_images(id,user_id,url,thumbnail,bytes) values(${id},${owner},${`https://blob.example/${id}.webp`},'https://blob.example/thumb.webp',100)`;
  return id;
}
function input(imageIds: string[], extra: Record<string, unknown> = {}) {
  return {
    ...EMPTY_PROPERTY,
    title: "Casa com quintal em bairro tranquilo",
    description:
      "Casa espaçosa com bastante luz natural e quintal amplo para aproveitar com a família.",
    city: "São José dos Campos",
    neighborhood: "Centro",
    area: 150,
    bedrooms: 3,
    parking: 2,
    price: 500000,
    advertiser: "Maria Silva",
    phone: "11999999999",
    consent: true,
    submit: true,
    imageIds,
    ...extra,
  };
}
async function create(extra: Record<string, unknown> = {}) {
  return repo.saveProperty(user, input([await photo()], extra));
}
async function stored(id: string) {
  const [p] = await db.sql`select * from properties where id=${id}`;
  return p;
}
function request(
  path: string,
  data?: unknown,
  method = "POST",
  origin = "http://localhost:3000",
) {
  return new Request(`http://localhost:3000/api/imoveis${path}`, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.8",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

describe("Imóveis — persistência e publicação real em Postgres isolado", () => {
  it("persiste preço e taxas com centavos e recusa precisão monetária inválida", async () => {
    const values = {
      price: 2659574.47,
      condo: 930.5,
      iptu: 3000.75,
      fees: 25.99,
    };
    const id = await create(values);
    expect((await repo.ownProperty(user, id)).data).toMatchObject(values);
    await repo.transition(other, id, "published", true);
    expect(
      (await repo.publicProperty(String((await stored(id)).slug)))?.data,
    ).toMatchObject(values);
    for (const field of ["price", "condo", "iptu", "fees"]) {
      expect(() =>
        parseProperty(input([randomUUID()], { [field]: 2.65957447 })),
      ).toThrow("duas casas decimais");
    }
  });
  it("salva link válido do YouTube e nome da corretora, recusando links externos", async () => {
    const id = await create({
      advertiserType: "Imobiliária",
      creci: "SP 123456-F",
      watermarkName: "Imobiliária Alameda",
      videoUrl: "https://youtu.be/M7lc1UVf-VE?t=30",
    });
    const saved = (await repo.ownProperty(user, id)).data;
    expect(saved.watermarkName).toBe("Imobiliária Alameda");
    expect(saved.videoUrl).toBe("https://www.youtube.com/watch?v=M7lc1UVf-VE");
    expect(() =>
      parseProperty(
        input([randomUUID()], {
          videoUrl: "https://example.com/watch?v=M7lc1UVf-VE",
        }),
      ),
    ).toThrow("link de um vídeo");
    expect(() =>
      parseProperty(
        input([randomUUID()], { videoUrl: "https://youtu.be/abc" }),
      ),
    ).toThrow("link de um vídeo");
    expect(() =>
      parseProperty(
        input([randomUUID()], {
          advertiserType: "Corretor",
          creci: "SP 123456-F",
          watermarkName: "",
        }),
      ),
    ).toThrow("nome da corretora");
  });
  it("persiste anúncio e fotos na ordem, permite capa e reordenação, e oculta até aprovação", async () => {
    const a = await photo(),
      b = await photo();
    const id = await repo.saveProperty(user, input([b, a]));
    expect((await repo.searchProperties(new URLSearchParams())).total).toBe(0);
    expect((await repo.ownProperty(user, id)).images.map((i) => i.id)).toEqual([
      b,
      a,
    ]);
    await repo.transition(other, id, "published", true);
    const publicPage = await repo.publicProperty(
      String((await stored(id)).slug),
    );
    expect(publicPage?.images.map((i) => i.id)).toEqual([b, a]);
    expect(JSON.stringify(publicPage)).not.toContain("11999999999");
    expect(publicPage).not.toHaveProperty("private_data");
    await repo.saveProperty(
      user,
      input([a, b], { price: 450000, revision: 2 }),
      id,
    );
    expect((await repo.ownProperty(user, id)).data.price).toBe(450000);
    expect((await repo.ownProperty(user, id)).images[0].id).toBe(a);
    expect((await stored(id)).status).toBe("pending");
    expect(
      (await db.sql`select * from property_history where property_id=${id}`)
        .length,
    ).toBe(3);
  });
  it("protege edição, exclusão, contato privado e fotos contra outra conta", async () => {
    const id = await create();
    await expect(repo.ownProperty(other, id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      repo.saveProperty(
        other,
        input([await photo(other)], { revision: 1 }),
        id,
      ),
    ).rejects.toThrow("indisponível");
    await expect(repo.transition(other, id, "removed")).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      repo.saveProperty(other, input([await photo(user)])),
    ).rejects.toThrow("Foto não pertence");
    await expect(
      images.removeImage(
        other,
        (await repo.ownProperty(user, id)).images[0].id,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect((await stored(id)).status).toBe("pending");
  });
  it("detecta edição concorrente e duplicação sem perder o anúncio anterior", async () => {
    const id = await create(),
      p = await repo.ownProperty(user, id);
    await expect(
      repo.saveProperty(
        user,
        input(
          p.images.map((i) => i.id),
          { revision: 0 },
        ),
        id,
      ),
    ).rejects.toThrow("Outra edição");
    await expect(create()).rejects.toMatchObject({ code: "23505" });
    expect((await stored(id)).revision).toBe(1);
  });
  it("permite rascunho incompleto, impede publicar sem validação e exige consentimento", async () => {
    const id = await repo.saveProperty(user, {
      ...EMPTY_PROPERTY,
      imageIds: [],
      phone: "",
      submit: false,
    });
    expect((await stored(id)).status).toBe("draft");
    await expect(repo.transition(user, id, "pending")).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      repo.transition(other, id, "published", true),
    ).rejects.toMatchObject({ status: 409 });
    expect(() => parseProperty(input([]))).toThrow("foto");
    expect(() =>
      parseProperty(input([randomUUID()], { consent: false })),
    ).toThrow("Autorize");
    expect(() =>
      parseProperty(
        input([randomUUID()], {
          advertiserType: "Corretor",
          creci: "",
          watermarkName: "Imobiliária Alameda",
        }),
      ),
    ).toThrow("CRECI");
    expect(() =>
      parseProperty(input([randomUUID()], { price: Infinity })),
    ).toThrow("Valor inválido");
  });
  it("filtra por URL, ordena preços, pagina e só retorna favoritos do dono", async () => {
    const first = await create();
    await repo.transition(other, first, "published", true);
    const second = await create({
      title: "Apartamento amplo com excelente localização",
      price: 300000,
      type: "Apartamento",
      bedrooms: 2,
    });
    await repo.transition(other, second, "published", true);
    const result = await repo.searchProperties(
      new URLSearchParams({
        city: "são josé dos campos",
        min: "200000",
        max: "400000",
        bedrooms: "2",
      }),
    );
    expect(result.items.map((i) => i.id)).toEqual([second]);
    expect(
      (
        await repo.searchProperties(new URLSearchParams({ sort: "price-desc" }))
      ).items.map((i) => i.id),
    ).toEqual([first, second]);
    await db.sql`insert into property_favorites values(${user},${first})`;
    expect(
      (await repo.searchProperties(new URLSearchParams(), user)).items.map(
        (i) => i.id,
      ),
    ).toEqual([first]);
    expect(
      (await repo.searchProperties(new URLSearchParams(), other)).total,
    ).toBe(0);
    expect(
      (await repo.searchProperties(new URLSearchParams({ page: "2" }))).items,
    ).toHaveLength(0);
    expect(
      parseFilters(new URLSearchParams({ min: "NaN", page: "-4" })),
    ).toMatchObject({ min: 0, page: 1 });
  });
  it("pausa, reativa com análise, vende e retira do sitemap e do contato", async () => {
    const id = await create();
    await repo.transition(other, id, "published", true);
    expect(await repo.sitemapEntries()).toHaveLength(1);
    await repo.transition(user, id, "paused");
    expect(await repo.sitemapEntries()).toHaveLength(0);
    expect(
      await repo.publicProperty(String((await stored(id)).slug)),
    ).toBeNull();
    await repo.transition(user, id, "pending");
    await repo.transition(other, id, "published", true);
    await repo.transition(user, id, "sold");
    expect(
      (await repo.publicProperty(String((await stored(id)).slug)))?.status,
    ).toBe("sold");
    await expect(repo.activeContact(id)).rejects.toMatchObject({ status: 404 });
    expect(await repo.sitemapEntries()).toHaveLength(0);
  });
  it("exclui fotos desanexadas, telefone, endereço, favoritos e histórico de conteúdo", async () => {
    const a = await photo(),
      b = await photo();
    const id = await repo.saveProperty(
      user,
      input([a, b], { address: "Rua privada, 123" }),
    );
    await repo.saveProperty(user, input([b], { revision: 1 }), id);
    expect(
      (
        await db.sql`select delete_pending from property_images where id=${a}`
      )[0].delete_pending,
    ).toBe(true);
    await repo.transition(user, id, "removed");
    expect((await stored(id)).private_data).toBe("");
    expect((await stored(id)).data).toEqual({});
    expect(await repo.ownProperties(user)).toHaveLength(0);
    await images.cleanupImages();
    expect(await db.sql`select * from property_images`).toHaveLength(0);
    expect(
      JSON.stringify(await db.sql`select * from property_history`),
    ).not.toContain("Rua privada");
  });
  it("suspensão e conta desativada retiram anúncios da pesquisa e impedem novos uploads", async () => {
    const id = await create();
    await repo.transition(other, id, "published", true);
    await db.sql`insert into property_advertisers values(${user},true)`;
    expect((await repo.searchProperties(new URLSearchParams())).total).toBe(0);
    await expect(
      create({ title: "Outro imóvel para tentar publicar" }),
    ).rejects.toThrow("suspenso");
    expect(
      (
        await db.sql`select reserve_property_image(${user}::uuid,${randomUUID()}::uuid) as ok`
      )[0].ok,
    ).toBe(false);
    await db.sql`update property_advertisers set suspended=false`;
    await db.sql`update users set disabled_at=now() where id=${user}`;
    expect(
      await repo.publicProperty(String((await stored(id)).slug)),
    ).toBeNull();
  });
  it("aplica quota de anúncios, rate limit e orçamento de storage", async () => {
    await db.sql`update property_settings set config=jsonb_set(config,'{maxListings}','1')`;
    await create();
    await expect(
      create({ title: "Outra casa com quintal e lazer" }),
    ).rejects.toThrow("Limite");
    await repo.quota("test", 1);
    await expect(repo.quota("test", 1)).rejects.toMatchObject({ status: 429 });
    await db.sql`update property_settings set config=jsonb_set(config,'{storageMB}','0')`;
    expect(
      (
        await db.sql`select reserve_property_image(${user}::uuid,${randomUUID()}::uuid) as ok`
      )[0].ok,
    ).toBe(false);
    await db.sql`update property_settings set config=jsonb_set(config,'{storageMB}','500')`;
  });
  it("recusa moderação de versão alterada e expira anúncios sem expor contato", async () => {
    const id = await create();
    await expect(
      repo.transition(other, id, "published", true, "", 999),
    ).rejects.toMatchObject({ status: 409 });
    await repo.transition(other, id, "published", true, "", 1);
    await db.sql`update properties set expires_at=now()-interval '1 second' where id=${id}`;
    expect(await repo.sitemapEntries()).toHaveLength(0);
    await expect(repo.activeContact(id)).rejects.toMatchObject({ status: 404 });
    await images.cleanupImages();
    expect((await stored(id)).status).toBe("paused");
  });
});
describe("Imóveis — APIs e imagens", () => {
  it("gera SEO público, sitemap ativo e imagem PNG de compartilhamento", async () => {
    const id = await create();
    await repo.transition(other, id, "published", true);
    const buffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#004b5a" },
    })
      .webp()
      .toBuffer();
    const photo = `https://test.public.blob.vercel-storage.com/imoveis/${id}.webp`;
    await db.sql`update property_images set url=${photo} where property_id=${id}`;
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === photo
          ? new Response(buffer, { headers: { "content-type": "image/webp" } })
          : originalFetch(input, init),
      ),
    );
    expect(
      await images.sharePhoto("https://evil.example/image.webp"),
    ).toBeNull();
    expect(await images.sharePhoto(photo)).toMatch(/^data:image\/png;base64,/);
    const slug = String((await stored(id)).slug),
      params = Promise.resolve({ slug });
    const { generateMetadata } = await import("@/app/imoveis/[slug]/page");
    const meta = await generateMetadata({ params });
    expect(meta.alternates?.canonical).toBe(
      `https://alilu.com.br/imoveis/${slug}`,
    );
    expect(JSON.stringify(meta)).not.toContain("11999999999");
    const { default: sitemap } = await import("@/app/imoveis/sitemap");
    expect((await sitemap()).some((e) => e.url.endsWith(slug))).toBe(true);
    const { default: og } = await import(
      "@/app/imoveis/[slug]/opengraph-image"
    );
    const response = await og({ params });
    expect(response.status).toBe(200);
    expect(
      Buffer.from(await response.arrayBuffer())
        .subarray(0, 4)
        .toString("hex"),
    ).toBe("89504e47");
    await repo.transition(user, id, "rented");
    expect((await generateMetadata({ params })).robots).toEqual({
      index: false,
      follow: true,
    });
    expect((await sitemap()).some((e) => e.url.endsWith(slug))).toBe(false);
  }, 15000);
  it("faz upload validado, persiste URLs e mantém fila se a exclusão do Blob falhar", async () => {
    const file = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#004b5a" },
    })
      .jpeg()
      .toBuffer();
    const req = new Request(
      "http://localhost:3000/api/imoveis/photos?name=foto.jpg&watermark=Alameda%20Im%C3%B3veis",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "image/jpeg",
        },
        body: file,
      },
    );
    const response = await api.POST(req);
    expect(response.status).toBe(201);
    const saved = await response.json();
    expect(saved.url).toContain(`/imoveis/${user}/${saved.id}.webp`);
    const [record] =
      await db.sql`select * from property_images where id=${saved.id}`;
    expect(record.user_id).toBe(user);
    expect(Number(record.bytes)).toBeGreaterThan(0);
    await images.removeImage(user, saved.id);
    const provider = await import("@vercel/blob");
    vi.mocked(provider.del).mockRejectedValueOnce(
      new Error("storage temporarily unavailable"),
    );
    await expect(images.cleanupImages()).rejects.toThrow(
      "storage temporarily unavailable",
    );
    expect(
      await db.sql`select * from property_images where id=${saved.id}`,
    ).toHaveLength(1);
    await images.cleanupImages();
    expect(
      await db.sql`select * from property_images where id=${saved.id}`,
    ).toHaveLength(0);
  });
  it("constrói WhatsApp com link correto, deduplica cliques e recebe denúncias", async () => {
    const id = await create();
    await repo.transition(other, id, "published", true);
    const response = await api.POST(request(`/${id}/contact`));
    expect(response.status).toBe(200);
    const { url } = await response.json();
    expect(url).toContain("https://wa.me/5511999999999?text=");
    expect(decodeURIComponent(url)).toContain(
      `/imoveis/${(await stored(id)).slug}`,
    );
    await api.POST(request(`/${id}/contact`));
    expect(Number((await stored(id)).contacts)).toBe(1);
    expect(
      (
        await api.POST(
          request(`/${id}/report`, {
            reason: "Possível uso não autorizado das fotos.",
          }),
        )
      ).status,
    ).toBe(200);
    expect(await db.sql`select * from property_reports`).toHaveLength(1);
    await repo.transition(
      other,
      id,
      "rejected",
      true,
      "Fotos precisam de revisão",
    );
    expect(
      (await db.sql`select resolved from property_reports`)[0].resolved,
    ).toBe(true);
    expect((await api.POST(request(`/${id}/contact`))).status).toBe(404);
  });
  it("rejeita origem externa, admin não autorizado e body excessivo", async () => {
    expect((await api.POST(request("", null))).status).toBe(400);
    expect(() =>
      checkOrigin(
        new Request("http://internal:3000/api/imoveis", {
          headers: {
            host: "alilu.com.br",
            origin: "https://alilu.com.br",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      checkOrigin(
        new Request("http://internal:3000/api/imoveis", {
          headers: {
            host: "alilu.com.br",
            origin: "https://evil.example",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toThrow("Origem inválida");
    expect(
      (await api.POST(request("", {}, "POST", "https://evil.example"))).status,
    ).toBe(403);
    expect((await api.PUT(request("/admin/settings", {}, "PUT"))).status).toBe(
      403,
    );
    expect(
      (await api.POST(request("", { description: "x".repeat(66000) }))).status,
    ).toBe(413);
    session.user.id = "";
    expect((await api.POST(request("", {}))).status).toBe(401);
  });
  it("rejeita conteúdo falso, extensão/tipo incoerentes e remove EXIF em foto válida", async () => {
    const original = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: "#004b5a" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "PRIVATE PERSON" } } })
      .toBuffer();
    const result = await images.processImage(original, "jpg", "image/jpeg");
    const marked = await images.processImage(
      original,
      "jpg",
      "image/jpeg",
      "Nara & Filhos <Imóveis>",
    );
    const meta = await sharp(result.full).metadata();
    expect(meta.width).toBe(1600);
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("webp");
    expect((await sharp(result.thumb).metadata()).width).toBe(480);
    expect((await sharp(marked.full).metadata()).width).toBe(1600);
    expect(marked.full.equals(result.full)).toBe(false);
    expect(marked.thumb.equals(result.thumb)).toBe(false);
    expect(images.watermarkSvg(800, 600, "Nara & Filhos").toString()).toContain(
      "Nara &amp; Filhos",
    );
    await expect(
      images.processImage(Buffer.from("not a photo"), "jpg", "image/jpeg"),
    ).rejects.toThrow("Imagem inválida");
    await expect(
      images.processImage(original, "png", "image/png"),
    ).rejects.toThrow("Imagem inválida");
    await expect(
      images.processImage(original, "svg", "image/svg+xml"),
    ).rejects.toThrow("JPEG");
  });
});

// Optional local-only visual fixture. Never writes to Neon, Blob or production.
it.skipIf(process.env.IMOVEIS_VISUAL_QA !== "1")(
  "gera páginas locais para revisão visual",
  async () => {
    const id = await create();
    await repo.transition(other, id, "published", true);
    const image = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#dbe9e6" },
    })
      .webp()
      .toBuffer();
    const url = `data:image/webp;base64,${image.toString("base64")}`;
    await db.sql`update property_images set url=${url},thumbnail=${url}`;
    const { PropertySearch } = await import(
      "@/components/imoveis/PropertySearch"
    );
    const { PropertyForm } = await import("@/components/imoveis/PropertyForm");
    const { default: Layout } = await import("@/app/imoveis/layout");
    const { default: Detail } = await import("@/app/imoveis/[slug]/page");
    const { FinancingTool } = await import(
      "@/components/tools/financing/FinancingTool"
    );
    const folder = join(process.cwd(), ".codex-temp", "imoveis-qa");
    mkdirSync(folder, { recursive: true });
    const cssFolder = join(process.cwd(), ".next", "static", "chunks");
    const css =
      readdirSync(cssFolder)
        .filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(join(cssFolder, f), "utf8"))
        .join("\n") + readFileSync("app/imoveis/imoveis.css", "utf8");
    const listing = await PropertySearch({
      params: new URLSearchParams(),
      config: await repo.settings(),
    });
    const detail = await Detail({
      params: Promise.resolve({ slug: String((await stored(id)).slug) }),
    });
    const form = createElement(PropertyForm, {
      config: await repo.settings(),
      initial: await repo.ownProperty(user, id),
    });
    for (const [file, content] of [
      ["list", listing],
      ["detail", detail],
      ["form", form],
      ["finance", createElement(FinancingTool, { initialAssetValue: 500000 })],
    ] as const) {
      writeFileSync(
        join(folder, `${file}.html`),
        `<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA local — Imóveis Alilu</title><style>${css}</style><body style="font-family:Arial,sans-serif"><div style="background:#fff4df;padding:8px;text-align:center;font-size:12px">Prévia local de teste — dados fictícios, fora da produção</div>${renderToStaticMarkup(createElement(Layout, null, content))}</body></html>`,
      );
    }
  },
);
