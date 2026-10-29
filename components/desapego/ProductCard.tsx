/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { MapPin, RefreshCcw } from "lucide-react";
import { productMoney, type ProductAd } from "@/lib/desapego/model";

export function ProductCard({ ad }: { ad: ProductAd }) {
  const d=ad.data;
  return <Link href={`/desapego/${ad.slug}`} className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:border-brand-primary/40 hover:shadow-md">
    <div className="relative aspect-[4/3] overflow-hidden bg-brand-primary-soft">
      {ad.images[0]?<img src={ad.images[0].thumbnail} alt={d.title} width={480} height={360} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/>:<span className="flex h-full items-center justify-center text-brand-primary">Foto em preparação</span>}
      {d.acceptsExchange?<span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-primary"><RefreshCcw size={12}/> Aceita troca</span>:null}
    </div>
    <div className="p-4">
      <p className="text-xs font-medium text-brand-primary">{d.category}{d.subcategory?` · ${d.subcategory}`:""}</p>
      <h2 className="mt-1 line-clamp-2 min-h-12 font-semibold text-zinc-900">{d.title}</h2>
      <p className="mt-2 text-xl font-bold text-brand-primary">{productMoney(d.price)} {d.negotiable?<span className="text-xs font-normal text-zinc-500">negociável</span>:null}</p>
      <p className="mt-2 flex items-center gap-1 text-sm text-zinc-500"><MapPin size={15}/>{d.neighborhood?`${d.neighborhood}, `:""}{d.city} / {d.state}</p>
      <p className="mt-1 text-xs text-zinc-500">{d.condition}</p>
      <p className="mt-2 text-xs text-zinc-400">Publicado em {new Date(ad.published_at??ad.updated_at).toLocaleDateString("pt-BR")}</p>
    </div>
  </Link>;
}
