import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { searchProducts, productCities } from "@/lib/desapego/repository";
import { DESAPEGO_STATES, PRODUCT_CONDITIONS, type DesapegoSettings } from "@/lib/desapego/model";

export async function DesapegoSearch({params,config}:{params:URLSearchParams;config:DesapegoSettings}) {
  const [result,locations]=await Promise.all([searchProducts(params),productCities()]);
  if(result.page>1&&!result.items.length) return <section className="estate-panel py-12 text-center"><h2 className="text-xl font-semibold">Não há mais anúncios nesta página.</h2><Link className="mt-4 inline-block text-brand-primary underline" href="/desapego">Ver todos os produtos</Link></section>;
  const pageLink=(page:number)=>{const next=new URLSearchParams(params);next.set("page",String(page));return `/desapego?${next}`;};
  return <>
    <section className="mb-7 rounded-3xl bg-brand-primary p-6 text-white sm:p-9">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-white/70">Dê uma nova vida ao que você não usa</p>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold sm:text-4xl">Alilu Desapego</h1><p className="mt-2 max-w-2xl text-white/85">Encontre produtos usados perto de você. Negocie diretamente com quem anuncia, sem pagamento ou comissão pela Alilu.</p></div><Link href="/desapego/anunciar" className="estate-button secondary">+ Anunciar grátis</Link></div>
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[270px_1fr]">
      <form action="/desapego" className="estate-panel space-y-3">
        <label>Buscar produto<input name="q" maxLength={100} defaultValue={params.get("q")??""} placeholder="Nome, marca ou modelo"/></label>
        <label>Categoria<select name="category" defaultValue={params.get("category")??""}><option value="">Todas</option>{config.categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label>
        <label>Subcategoria<input name="subcategory" maxLength={100} defaultValue={params.get("subcategory")??""} placeholder="Ex.: notebooks"/></label>
        <label>Estado<select name="state" defaultValue={params.get("state")??""}><option value="">Todos</option>{DESAPEGO_STATES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Cidade<input name="city" maxLength={100} defaultValue={params.get("city")??""} placeholder="Sua cidade"/></label>
        <label>Conservação<select name="condition" defaultValue={params.get("condition")??""}><option value="">Todas</option>{PRODUCT_CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Marca<input name="brand" maxLength={80} defaultValue={params.get("brand")??""}/></label>
        <div className="grid grid-cols-2 gap-2"><label>Preço mínimo<input name="min" type="number" min="0" step="0.01" defaultValue={params.get("min")??""}/></label><label>Preço máximo<input name="max" type="number" min="0" step="0.01" defaultValue={params.get("max")??""}/></label></div>
        <label><input type="checkbox" name="exchange" value="1" defaultChecked={params.get("exchange")==="1"}/> Aceita troca</label>
        <label>Ordenar por<select name="sort" defaultValue={params.get("sort")??"recent"}><option value="recent">Mais recentes</option><option value="price">Menor preço</option><option value="price-desc">Maior preço</option></select></label>
        <button className="estate-button w-full"><Search size={16}/>Buscar produtos</button><Link href="/desapego" className="block text-center text-sm text-brand-primary underline">Limpar filtros</Link>
      </form>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-500">{result.total} {result.total===1?"produto encontrado":"produtos encontrados"}</p><div className="flex gap-4"><Link href="/desapego/favoritos" className="text-sm font-medium text-brand-primary underline">Favoritos</Link><Link href="/desapego/meus-anuncios" className="text-sm font-medium text-brand-primary underline">Meus anúncios</Link></div></div>
        {result.items.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.items.map(ad=><ProductCard key={ad.id} ad={ad}/>)}</div>:<div className="estate-panel flex flex-col items-center gap-3 py-12 text-center"><ShoppingBag size={38} className="text-brand-primary"/><h2 className="text-xl font-semibold">Ainda não há produtos para estes filtros.</h2><p className="max-w-md text-sm text-zinc-500">Seja a primeira pessoa a anunciar algo na sua região.</p><Link className="estate-button" href="/desapego/anunciar">Anunciar grátis</Link></div>}
        <nav aria-label="Paginação" className="mt-6 flex justify-center gap-4">{result.page>1?<Link className="estate-button secondary" href={pageLink(result.page-1)}>← Anterior</Link>:null}<span className="self-center text-sm">Página {result.page}</span>{result.page*12<result.total?<Link className="estate-button secondary" href={pageLink(result.page+1)}>Próxima →</Link>:null}</nav>
        {locations.length?<section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Desapego por cidade</h2><div className="flex flex-wrap gap-2">{locations.map(c=><Link key={`${c.state}-${c.city}`} href={`/desapego?state=${c.state}&city=${encodeURIComponent(c.city)}`} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-brand-primary">{c.city} / {c.state}</Link>)}</div></section>:null}
      </section>
    </div>
  </>;
}
