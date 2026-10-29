import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { encryptSecret, decryptSecret } from "@/lib/instagram/backend/encryption";
import { DEFAULT_PRODUCT_CATEGORIES, parseProduct, parseProductFilters, productSlug, DesapegoError, type DesapegoSettings, type ProductAd, type ProductCategory } from "./model";

export const DEFAULT_DESAPEGO_SETTINGS: DesapegoSettings = {
  maxListings: 10, maxPhotos: 15, storageMB: 500,
  categories: DEFAULT_PRODUCT_CATEGORIES.map((item) => ({ name: item.name, subcategories: [...item.subcategories] })),
};

export const settings = cache(async (): Promise<DesapegoSettings> => {
  const [row] = await getDb()`select config from desapego_settings where id=1`;
  return row.config as DesapegoSettings;
});

const projection = `a.id,a.slug,a.status,a.data,a.revision,a.updated_at::text,a.published_at::text,coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'url',i.url,'thumbnail',i.thumbnail) order by i.position) from desapego_images i where i.ad_id=a.id and not i.delete_pending and i.url<>''),'[]'::jsonb) as images`;
const visible = `not exists(select 1 from desapego_advertisers s where s.user_id=a.user_id and s.suspended) and not exists(select 1 from users u where u.id=a.user_id and u.disabled_at is not null)`;

export async function searchProducts(params: URLSearchParams, favoriteUser?: string) {
  const f = parseProductFilters(params);
  const order: Record<string,string> = { price: `(a.data->>'price')::numeric asc`, "price-desc": `(a.data->>'price')::numeric desc` };
  const where = `a.status='published' and (a.expires_at is null or a.expires_at>now()) and ${visible}
    and ($1='' or a.data->>'category'=$1) and ($2='' or a.data->>'subcategory'=$2)
    and ($3='' or a.data->>'state'=$3) and ($4='' or lower(a.data->>'city')=lower($4))
    and ($5='' or a.data->>'condition'=$5) and ($6='' or lower(a.data->>'brand')=lower($6))
    and (a.data->>'price')::numeric between $7 and $8
    and (not $9 or coalesce((a.data->>'acceptsExchange')::boolean,false))
    and ($10='' or to_tsvector('simple',coalesce(a.data->>'title','')||' '||coalesce(a.data->>'description','')||' '||coalesce(a.data->>'brand','')||' '||coalesce(a.data->>'model','')) @@ plainto_tsquery('simple',$10))
    and ($11::uuid is null or exists(select 1 from desapego_favorites f where f.ad_id=a.id and f.user_id=$11::uuid))`;
  const args = [f.category,f.subcategory,f.state,f.city,f.condition,f.brand,f.min,f.max,f.acceptsExchange,f.q,favoriteUser??null];
  const db = getDb();
  const [rows,count] = await Promise.all([
    db.query(`select ${projection},a.views::int,a.contacts::int from desapego_ads a where ${where} order by ${Object.hasOwn(order,f.sort)?order[f.sort]:"a.created_at desc"},a.id limit 12 offset $12`,[...args,(f.page-1)*12]),
    db.query(`select count(*)::int as total from desapego_ads a where ${where}`,args),
  ]);
  return { items: rows as ProductAd[], total: Number(count[0].total), page: f.page };
}

export async function publicProduct(slug: string): Promise<ProductAd|null> {
  const rows = await getDb().query(`select ${projection} from desapego_ads a where a.slug=$1 and a.status in ('published','sold') and ${visible}`,[slug]);
  return (rows[0] as ProductAd) ?? null;
}

export async function ownProduct(user: string,id: string) {
  const rows = await getDb().query(`select ${projection},a.private_data,a.reason,a.views::int,a.contacts::int from desapego_ads a where a.id=$1 and a.user_id=$2 and a.status<>'removed'`,[id,user]);
  if (!rows[0]) throw new DesapegoError("Anúncio não encontrado.",404);
  const { private_data,...rest } = rows[0];
  return { ...rest,...JSON.parse(decryptSecret(private_data as string)) } as ProductAd & { phone: string; zip: string; consent: boolean };
}

export async function ownProducts(user:string) {
  return await getDb().query(`select ${projection},a.reason,a.views::int,a.contacts::int from desapego_ads a where a.user_id=$1 and a.status<>'removed' order by a.updated_at desc limit 200`,[user]) as ProductAd[];
}

export async function isProductFavorite(user:string,id:string) {
  const rows=await getDb().query(`select 1 from desapego_favorites where user_id=$1 and ad_id=$2`,[user,id]);
  return rows.length>0;
}

export async function saveProduct(user:string,input:unknown,id?:string) {
  const parsed = parseProduct(input,await settings());
  const productId = id ?? randomUUID();
  const slug = productSlug(parsed.data.title,parsed.data.city,productId);
  const fingerprint = createHash("sha256").update(JSON.stringify([parsed.data.title.toLocaleLowerCase(),parsed.data.category,parsed.data.brand.toLocaleLowerCase(),parsed.data.model.toLocaleLowerCase(),parsed.data.city.toLocaleLowerCase()])).digest("hex");
  const privateData = encryptSecret(JSON.stringify({phone:parsed.phone,zip:parsed.zip,consent:parsed.consent,consentAt:parsed.consent?new Date().toISOString():null,termsVersion:"desapego-2026-10"}));
  const revision = Number((input as Record<string,unknown>).revision??0);
  if (!Number.isInteger(revision)||revision<0) throw new DesapegoError("Revisão inválida.");
  await getDb()`select desapego_save(${user}::uuid,${productId}::uuid,${slug},${JSON.stringify(parsed.data)}::jsonb,${privateData},${fingerprint},${parsed.imageIds}::uuid[],${parsed.submit},${revision})`;
  return productId;
}

export async function transitionProduct(actor:string,id:string,status:string,admin=false,reason="",revision:number|null=null) {
  const [row] = await getDb()`select desapego_transition(${actor}::uuid,${id}::uuid,${status},${admin},${reason},${revision}::int) as ok`;
  if (!row.ok) throw new DesapegoError("Ação indisponível para este anúncio. Atualize a página.",409);
}

export async function quota(key:string,limit:number,seconds=60) {
  const rows = await getDb()`insert into desapego_rate_limits(key) values(${key}) on conflict(key) do update set calls=case when desapego_rate_limits.window_start<now()-${seconds}*interval '1 second' then 1 else desapego_rate_limits.calls+1 end,window_start=case when desapego_rate_limits.window_start<now()-${seconds}*interval '1 second' then now() else desapego_rate_limits.window_start end where desapego_rate_limits.window_start<now()-${seconds}*interval '1 second' or desapego_rate_limits.calls<${limit} returning key`;
  if (!rows.length) throw new DesapegoError("Muitas tentativas. Aguarde um pouco.",429);
}

export async function contactProduct(id:string) {
  const rows=await getDb().query(`select a.private_data,a.slug,a.data->>'title' as title from desapego_ads a where a.id=$1 and a.status='published' and (a.expires_at is null or a.expires_at>now()) and ${visible}`,[id]);
  if (!rows[0]) throw new DesapegoError("Contato indisponível.",404);
  return { phone:JSON.parse(decryptSecret(rows[0].private_data as string)).phone as string,slug:rows[0].slug as string,title:rows[0].title as string };
}

export async function productCities() {
  return await getDb().query(`select a.data->>'city' as city,a.data->>'state' as state,count(*)::int as total from desapego_ads a where a.status='published' and (a.expires_at is null or a.expires_at>now()) and ${visible} group by 1,2 order by 3 desc limit 200`) as {city:string;state:string;total:number}[];
}

export async function sitemapProducts() {
  return await getDb().query(`select a.slug,a.updated_at::text from desapego_ads a where a.status='published' and (a.expires_at is null or a.expires_at>now()) and ${visible} order by a.id limit 45000`) as {slug:string;updated_at:string}[];
}

export async function adminProducts(page:number) {
  const db=getDb();
  const [items,reports,usage]=await Promise.all([
    db.query(`select ${projection},a.user_id,a.reason,(select count(*)::int from desapego_ads d where d.id<>a.id and d.status<>'removed' and d.fingerprint=a.fingerprint) as potential_duplicates,(select coalesce(jsonb_agg(h order by h.id desc),'[]') from(select id,action,snapshot,created_at from desapego_history where ad_id=a.id order by id desc limit 10) h) as history from desapego_ads a where a.status<>'removed' order by (a.status='pending') desc,a.updated_at desc limit 25 offset $1`,[(page-1)*25]),
    db`select r.id,r.ad_id,r.reason,r.created_at::text,a.slug,a.revision,a.data->>'title' as title from desapego_reports r join desapego_ads a on a.id=r.ad_id where not r.resolved order by r.created_at limit 100`,
    db`select count(*)::int as photos,coalesce(sum(bytes),0)::text as bytes from desapego_images`,
  ]);
  return {items,reports,usage:usage[0],config:await settings()};
}

export function validateSettings(input:Record<string,unknown>):DesapegoSettings {
  const maxListings=Number(input.maxListings),maxPhotos=Number(input.maxPhotos),storageMB=Number(input.storageMB);
  if(!Number.isInteger(maxListings)||maxListings<1||maxListings>200||!Number.isInteger(maxPhotos)||maxPhotos<1||maxPhotos>15||!Number.isInteger(storageMB)||storageMB<10||storageMB>10000) throw new DesapegoError("Limites inválidos. São permitidas até 15 fotos por anúncio.");
  const categories=input.categories as ProductCategory[];
  if(!Array.isArray(categories)||!categories.length||categories.length>60||categories.some((c)=>!c||typeof c.name!=="string"||!c.name.trim()||c.name.length>100||!Array.isArray(c.subcategories)||c.subcategories.length>50||c.subcategories.some((s)=>typeof s!=="string"||!s.trim()||s.length>100))||new Set(categories.map(c=>c.name)).size!==categories.length) throw new DesapegoError("Confira as categorias e subcategorias.");
  return {maxListings,maxPhotos,storageMB,categories};
}
