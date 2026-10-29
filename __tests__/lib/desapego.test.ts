// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
let sql: TestDb["sql"] & { query: (text: string, args: unknown[]) => Promise<Record<string, unknown>[]> };
let user: string;
let other: string;
const session = vi.hoisted(() => ({ user: { id: "", email: "owner@example.com" } }));

vi.mock("@/lib/db/client", () => ({ getDb: () => sql }));
vi.mock("@/auth", () => ({ auth: async () => session }));
vi.mock("@/lib/admin/admin-access", () => ({ getAdminSession: async () => null }));

const repo = await import("@/lib/desapego/repository");

beforeAll(async () => {
  process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  db = await createTestDb();
  sql = Object.assign(db.sql, {
    query: async (text: string, args: unknown[]) =>
      (await db.pg.query<Record<string, unknown>>(text, args)).rows,
  });
}, 30000);

beforeEach(async () => {
  await db.pg.exec("truncate desapego_images,desapego_history,desapego_reports,desapego_favorites,desapego_ads,desapego_advertisers,desapego_rate_limits,users cascade");
  const rows = await db.sql`insert into users(email) values('desapego-a@example.com'),('desapego-b@example.com') returning id`;
  user = String(rows[0].id);
  other = String(rows[1].id);
  session.user.id = user;
});

afterAll(async () => {
  await db?.close();
  vi.unstubAllEnvs();
});

async function image(owner = user) {
  const id = randomUUID();
  await db.sql`insert into desapego_images(id,user_id,url,thumbnail,bytes) values(${id},${owner},${`https://blob.example/${id}.webp`},'https://blob.example/thumb.webp',100)`;
  return id;
}

function listing(imageIds: string[], extra: Record<string, unknown> = {}) {
  return {
    title: "Notebook em ótimo estado",
    category: "Computadores e notebooks",
    subcategory: "Notebooks",
    brand: "Marca",
    model: "Modelo 14",
    description: "Notebook conservado, funcionando perfeitamente e pronto para uso.",
    condition: "Usado em ótimo estado",
    price: 2659.75,
    previousPrice: 3000,
    negotiable: true,
    acceptsExchange: false,
    state: "SP",
    city: "São Paulo",
    neighborhood: "Centro",
    sellerName: "Joana",
    delivery: "Retirada combinada",
    phone: "11987654321",
    zip: "01001000",
    consent: true,
    submit: true,
    imageIds,
    ...extra,
  };
}

describe("Desapego — persistência e controle de anúncios", () => {
  it("salva em análise, publica com moderação e não expõe telefone nem CEP", async () => {
    const id = await repo.saveProduct(user, listing([await image()]));
    const ownerCopy = await repo.ownProduct(user, id);
    expect(ownerCopy.data.price).toBe(2659.75);
    expect(ownerCopy.phone).toBe("5511987654321");
    expect(ownerCopy.zip).toBe("01001000");
    expect((await db.sql`select status from desapego_ads where id=${id}`)[0].status).toBe("pending");

    await repo.transitionProduct(other, id, "published", true, "Revisado");
    const publicCopy = await repo.publicProduct(String((await db.sql`select slug from desapego_ads where id=${id}`)[0].slug));
    expect(publicCopy?.data.price).toBe(2659.75);
    expect(JSON.stringify(publicCopy)).not.toContain("5511987654321");
    expect(JSON.stringify(publicCopy)).not.toContain("01001000");
    expect(await repo.sitemapProducts()).toHaveLength(1);
  });

  it("impede que outra pessoa leia/edite o anúncio ou reutilize fotos alheias", async () => {
    const photo = await image();
    const id = await repo.saveProduct(user, listing([photo]));
    await expect(repo.ownProduct(other, id)).rejects.toMatchObject({ status: 404 });
    await expect(repo.saveProduct(other, listing([photo]), id)).rejects.toThrow("indisponível");
    await expect(repo.saveProduct(user, listing([await image()]))).rejects.toMatchObject({ code: "23505" });
  });

  it("respeita concorrência por revisão e deixa de listar vendido/pausado", async () => {
    const id = await repo.saveProduct(user, listing([await image()]));
    await expect(repo.saveProduct(user, listing((await repo.ownProduct(user, id)).images.map((i: {id:string})=>i.id), { revision: 0 }), id)).rejects.toThrow("Outra edição");
    await repo.transitionProduct(other, id, "published", true, "Revisado");
    await repo.transitionProduct(user, id, "sold");
    expect(await repo.searchProducts(new URLSearchParams())).toMatchObject({ total: 0 });
    expect(await repo.sitemapProducts()).toHaveLength(0);
    await expect(repo.contactProduct(id)).rejects.toMatchObject({ status: 404 });
  });
});
