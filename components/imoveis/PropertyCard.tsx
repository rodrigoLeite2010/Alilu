/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { MapPin, BedDouble, CarFront, Maximize } from "lucide-react";
import { money, type Property } from "@/lib/imoveis/model";
export function PropertyCard({ property: p }: { property: Property }) {
  const d = p.data;
  return (
    <Link
      href={`/imoveis/${p.slug}`}
      className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:border-brand-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-primary-soft">
        {p.images[0] ? (
          <img
            src={p.images[0].thumbnail}
            alt={d.title}
            width={480}
            height={360}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-brand-primary">
            Foto em preparação
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-primary">
          {d.purpose} · {d.type}
        </span>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-2xl font-bold text-brand-primary">
          {money(d.price)}
          <span className="text-xs font-normal text-zinc-500">
            {d.purpose === "Aluguel"
              ? " /mês"
              : d.purpose === "Temporada"
                ? " /diária"
                : ""}
          </span>
        </p>
        <h2 className="line-clamp-2 font-semibold">{d.title}</h2>
        {d.advertiserType !== "Proprietário" && (
          <p className="text-xs text-zinc-500">
            {d.advertiser} · CRECI {d.creci}
          </p>
        )}
        <p className="flex items-center gap-1 text-sm text-zinc-500">
          <MapPin size={15} />
          {d.neighborhood}, {d.city} / {d.state}
        </p>
        <div className="flex flex-wrap gap-4 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
          <span className="flex items-center gap-1">
            <Maximize size={16} />
            {d.area} m²
          </span>
          <span className="flex items-center gap-1">
            <BedDouble size={16} />
            {d.bedrooms} quartos
          </span>
          <span className="flex items-center gap-1">
            <CarFront size={16} />
            {d.parking} vagas
          </span>
        </div>
        <span className="block text-sm font-semibold text-brand-primary">
          Ver imóvel →
        </span>
      </div>
    </Link>
  );
}
