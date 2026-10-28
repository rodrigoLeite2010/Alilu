import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { publicProperty, searchProperties } from "@/lib/imoveis/repository";
import { money, STATUS } from "@/lib/imoveis/model";
import { SITE_URL } from "@/lib/seo/site";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  PropertyGallery,
  PropertyActions,
} from "@/components/imoveis/PropertyActions";
import { PropertyCard } from "@/components/imoveis/PropertyCard";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await publicProperty((await params).slug);
  if (!p)
    return {
      title: "Imóvel não encontrado",
      robots: { index: false, follow: false },
    };
  const meta = buildPageMetadata({
    title: `${p.data.title} — ${money(p.data.price)}`,
    description: `${p.data.type} em ${p.data.neighborhood}, ${p.data.city}/${p.data.state}. ${p.data.area} m². ${p.data.description.slice(0, 120)}`,
    path: `/imoveis/${p.slug}`,
    robots:
      p.status !== "published" ? { index: false, follow: true } : undefined,
  });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      images: [
        {
          url: `${SITE_URL}/imoveis/${p.slug}/opengraph-image`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image" as const,
      images: [`${SITE_URL}/imoveis/${p.slug}/opengraph-image`],
    },
  };
}
export default async function Page({ params }: Props) {
  const p = await publicProperty((await params).slug);
  if (!p) notFound();
  const d = p.data,
    url = `${SITE_URL}/imoveis/${p.slug}`;
  const related = (
    await searchProperties(
      new URLSearchParams({ city: d.city, state: d.state, type: d.type }),
    )
  ).items
    .filter((i) => i.id !== p.id)
    .slice(0, 3);
  const user = (await auth())?.user?.id;
  const saved = user
    ? (
        await getDb()`select 1 from property_favorites where user_id=${user} and property_id=${p.id}`
      ).length > 0
    : false;
  const structured = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: d.title,
    description: d.description,
    url,
    dateModified: p.updated_at,
    image: p.images.map((i) => i.url),
    offers: {
      "@type": "Offer",
      price: d.price,
      priceCurrency: "BRL",
      availability:
        p.status === "published"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      businessFunction:
        d.purpose === "Venda"
          ? "http://purl.org/goodrelations/v1#Sell"
          : "http://purl.org/goodrelations/v1#LeaseOut",
    },
    about: {
      "@type": "Place",
      name: d.type,
      address: {
        "@type": "PostalAddress",
        addressLocality: d.city,
        addressRegion: d.state,
        addressCountry: "BR",
      },
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
      <Link
        href="/imoveis"
        className="mb-5 inline-block text-sm text-brand-primary"
      >
        ← Explorar imóveis
      </Link>
      {p.status !== "published" && (
        <p
          role="status"
          className="mb-5 rounded-xl bg-brand-accent-soft p-4 font-semibold"
        >
          {STATUS[p.status]} — este imóvel não está disponível para novos
          contatos.
        </p>
      )}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <PropertyGallery images={p.images} title={d.title} />
          <div className="mt-7">
            <p className="text-sm font-semibold text-brand-primary">
              {d.type} · {d.purpose} · {d.condition}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{d.title}</h1>
            <p className="mt-3 text-zinc-500">
              {d.neighborhood}, {d.city} / {d.state}
            </p>
            <div className="my-6 flex flex-wrap gap-3">
              {[
                `${d.area} m² de área total`,
                ...(d.builtArea ? [`${d.builtArea} m² construídos`] : []),
                `${d.bedrooms} quartos`,
                `${d.suites} suítes`,
                `${d.bathrooms} banheiros`,
                `${d.parking} vagas`,
              ].map((v) => (
                <span
                  key={v}
                  className="rounded-xl bg-brand-primary-soft px-4 py-3 text-sm text-brand-primary"
                >
                  {v}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-semibold">
              Um pouco mais sobre o imóvel
            </h2>
            <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed text-zinc-600">
              {d.description}
            </p>
            <h2 className="mb-4 mt-8 text-xl font-semibold">Características</h2>
            <div className="flex flex-wrap gap-2">
              {[
                ...d.features,
                ...(d.financing ? ["Possibilidade de financiamento"] : []),
                ...(d.exchange ? ["Aceita permuta"] : []),
                ...(d.negotiable ? ["Preço negociável"] : []),
              ].map((v) => (
                <span
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
                  key={v}
                >
                  {v}
                </span>
              ))}
            </div>
            <section className="estate-panel mt-8">
              <h2 className="text-lg font-semibold">Localização aproximada</h2>
              <p className="my-3 text-sm text-zinc-500">
                Bairro {d.neighborhood}, {d.city} / {d.state}. O endereço exato
                é privado.
              </p>
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${d.neighborhood}, ${d.city}, ${d.state}, Brasil`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-brand-primary underline"
              >
                Ver a região no mapa →
              </a>
            </section>
          </div>
        </div>
        <aside className="estate-panel space-y-5 lg:sticky lg:top-24">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {d.purpose === "Venda"
                ? "Valor do imóvel"
                : d.purpose === "Temporada"
                  ? "Valor por diária"
                  : "Aluguel mensal"}
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-primary">
              {money(d.price)}
            </p>
            {d.negotiable && (
              <p className="mt-1 text-xs text-zinc-500">Preço negociável</p>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            {(
              [
                ["Condomínio / mês", d.condo],
                ["IPTU / ano", d.iptu],
                ["Outras taxas / mês", d.fees],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-zinc-500">{label}</dt>
                <dd>{value ? money(value) : "Não informado"}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-zinc-100 pt-4">
            <p className="font-semibold">{d.advertiser}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {d.advertiserType}
              {d.advertiserType !== "Proprietário" &&
                ` · CRECI ${d.creci} (informado)`}
            </p>
          </div>
          <PropertyActions
            id={p.id}
            url={url}
            available={p.status === "published"}
            saved={saved}
          />
          {d.purpose === "Venda" && (
            <Link
              href={`/imoveis/financiamento?valor=${d.price}`}
              className="block rounded-xl bg-brand-accent-soft p-4 text-sm font-semibold text-brand-primary"
            >
              Simular financiamento deste imóvel →
            </Link>
          )}
          <p className="text-xs leading-relaxed text-zinc-500">
            Informações fornecidas pelo anunciante. A Alilu não verifica a
            titularidade e não intermedeia pagamentos ou transações.
          </p>
        </aside>
      </div>
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-2xl font-semibold">
            Outros imóveis para conhecer
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((i) => (
              <PropertyCard key={i.id} property={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
