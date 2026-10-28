import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import {
  encryptSecret,
  decryptSecret,
} from "@/lib/instagram/backend/encryption";
import {
  parseFilters,
  parseProperty,
  PropertyError,
  slugify,
  type Property,
  type Settings,
} from "./model";

export const settings = cache(async (): Promise<Settings> => {
  const [row] = await getDb()`select config from property_settings where id=1`;
  return row.config as Settings;
});
// Explicit public projection: never select private_data or owner identifiers here.
const projection = `p.id,p.slug,p.status,p.data,p.revision,p.updated_at::text,coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'url',i.url,'thumbnail',i.thumbnail) order by i.position) from property_images i where i.property_id=p.id and not i.delete_pending and i.url<>''),'[]'::jsonb) as images`;
const visible = `(p.status<>'published' or p.expires_at>now()) and not exists(select 1 from property_advertisers a where a.user_id=p.user_id and a.suspended) and not exists(select 1 from users u where u.id=p.user_id and u.disabled_at is not null)`;
export async function searchProperties(
  params: URLSearchParams,
  favoriteUser?: string,
) {
  const f = parseFilters(params);
  const order: Record<string, string> = {
    price: `(p.data->>'price')::numeric asc`,
    "price-desc": `(p.data->>'price')::numeric desc`,
    area: `(p.data->>'area')::numeric desc`,
  };
  const where = `p.status='published' and ${visible}
    and ($1='' or p.data->>'purpose'=$1) and ($2='' or p.data->>'state'=$2)
    and ($3='' or lower(p.data->>'city')=lower($3)) and ($4='' or lower(p.data->>'neighborhood')=lower($4))
    and ($5='' or p.data->>'type'=$5) and (p.data->>'price')::numeric between $6 and $7
    and (p.data->>'bedrooms')::numeric >= $8 and (p.data->>'parking')::numeric >= $9
    and (p.data->>'area')::numeric >= $10 and (p.data->'features') @> $11::jsonb
    and ($12::uuid is null or exists(select 1 from property_favorites f where f.property_id=p.id and f.user_id=$12::uuid))`;
  const args = [
    f.purpose,
    f.state,
    f.city,
    f.neighborhood,
    f.type,
    f.min,
    f.max,
    f.bedrooms,
    f.parking,
    f.area,
    JSON.stringify(f.features),
    favoriteUser ?? null,
  ];
  const db = getDb();
  const [rows, count] = await Promise.all([
    db.query(
      `select ${projection} from properties p where ${where} order by ${Object.hasOwn(order, f.sort) ? order[f.sort] : "p.created_at desc"},p.id limit 12 offset $13`,
      [...args, (f.page - 1) * 12],
    ),
    db.query(
      `select count(*)::int as total from properties p where ${where}`,
      args,
    ),
  ]);
  return {
    items: rows as Property[],
    total: Number(count[0].total),
    page: f.page,
  };
}
export async function publicProperty(slug: string): Promise<Property | null> {
  const rows = await getDb().query(
    `select ${projection} from properties p where p.slug=$1 and p.status in ('published','sold','rented') and ${visible}`,
    [slug],
  );
  return (rows[0] as Property) ?? null;
}
export async function ownProperty(user: string, id: string) {
  const rows = await getDb().query(
    `select ${projection},p.private_data,p.reason,p.views::int,p.contacts::int from properties p where p.id=$1 and p.user_id=$2 and p.status<>'removed'`,
    [id, user],
  );
  if (!rows[0]) throw new PropertyError("Anúncio não encontrado.", 404);
  const { private_data, ...rest } = rows[0];
  return {
    ...rest,
    ...JSON.parse(decryptSecret(private_data as string)),
  } as Property & {
    phone: string;
    address: string;
    zip: string;
    consent: boolean;
  };
}
export async function ownProperties(user: string): Promise<Property[]> {
  return (await getDb().query(
    `select ${projection},p.reason,p.views::int,p.contacts::int from properties p where p.user_id=$1 and p.status<>'removed' order by p.updated_at desc limit 200`,
    [user],
  )) as Property[];
}
export async function saveProperty(user: string, input: unknown, id?: string) {
  const parsed = parseProperty(input, await settings());
  const propertyId = id ?? randomUUID();
  const slug = `${slugify(`${parsed.data.title}-${parsed.data.city}`)}-${propertyId}`;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        parsed.data.title.toLocaleLowerCase(),
        parsed.data.city.toLocaleLowerCase(),
        parsed.data.neighborhood.toLocaleLowerCase(),
        parsed.data.area,
        parsed.data.purpose,
      ]),
    )
    .digest("hex");
  const privateData = encryptSecret(
    JSON.stringify({
      phone: parsed.phone,
      address: parsed.address,
      zip: parsed.zip,
      consent: parsed.consent,
      consentAt: parsed.consent ? new Date().toISOString() : null,
      termsVersion: "imoveis-2026-10",
    }),
  );
  const revision = Number((input as Record<string, unknown>).revision ?? 0);
  if (!Number.isInteger(revision) || revision < 0)
    throw new PropertyError("Revisão inválida.");
  await getDb()`select save_property(${user}::uuid,${propertyId}::uuid,${slug},${JSON.stringify(parsed.data)}::jsonb,${privateData},${fingerprint},${parsed.imageIds}::uuid[],${parsed.submit},${revision})`;
  return propertyId;
}
export async function transition(
  user: string,
  id: string,
  status: string,
  admin = false,
  reason = "",
  revision: number | null = null,
) {
  const [row] =
    await getDb()`select transition_property(${user}::uuid,${id}::uuid,${status},${admin},${reason},${revision}::int) as ok`;
  if (!row.ok)
    throw new PropertyError(
      "Ação indisponível para este anúncio. Atualize a página.",
      409,
    );
}
export async function quota(key: string, limit: number, seconds = 60) {
  const rows =
    await getDb()`insert into property_rate_limits(key) values(${key}) on conflict(key) do update set
    calls=case when property_rate_limits.window_start < now()-${seconds}*interval '1 second' then 1 else property_rate_limits.calls+1 end,
    window_start=case when property_rate_limits.window_start < now()-${seconds}*interval '1 second' then now() else property_rate_limits.window_start end
    where property_rate_limits.window_start < now()-${seconds}*interval '1 second' or property_rate_limits.calls < ${limit} returning key`;
  if (!rows.length)
    throw new PropertyError("Muitas tentativas. Aguarde um pouco.", 429);
}
export async function activeContact(id: string) {
  const rows = await getDb().query(
    `select p.private_data,p.slug from properties p where p.id=$1 and p.status='published' and ${visible}`,
    [id],
  );
  if (!rows[0]) throw new PropertyError("Contato indisponível.", 404);
  return {
    phone: JSON.parse(decryptSecret(rows[0].private_data as string))
      .phone as string,
    slug: rows[0].slug as string,
  };
}
export async function cities() {
  return (await getDb().query(
    `select p.data->>'city' as city,p.data->>'state' as state,count(*)::int as total from properties p where p.status='published' and ${visible} group by 1,2 order by 3 desc limit 200`,
  )) as { city: string; state: string; total: number }[];
}
export async function sitemapEntries() {
  return (await getDb().query(
    `select p.slug,p.updated_at::text from properties p where p.status='published' and ${visible} order by p.id limit 45000`,
  )) as { slug: string; updated_at: string }[];
}
export async function adminOverview(page: number) {
  const db = getDb();
  const [items, reports, usage] = await Promise.all([
    db.query(
      `select ${projection},p.user_id,p.reason,(select coalesce(jsonb_agg(h order by h.id desc),'[]') from (select id,action,snapshot,created_at from property_history where property_id=p.id order by id desc limit 10) h) as history from properties p where p.status<>'removed' order by (p.status='pending') desc,p.updated_at desc limit 25 offset $1`,
      [(page - 1) * 25],
    ),
    db`select r.id,r.property_id,r.reason,r.created_at::text,p.slug,p.revision,p.data->>'title' as title from property_reports r join properties p on p.id=r.property_id where not r.resolved order by r.created_at limit 100`,
    db`select count(*)::int as photos,coalesce(sum(bytes),0)::text as bytes from property_images`,
  ]);
  return { items, reports, usage: usage[0], config: await settings() };
}
