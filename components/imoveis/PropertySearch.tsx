import Link from "next/link";
import { notFound } from "next/navigation";
import { Search, House } from "lucide-react";
import { STATES, PURPOSES, type Settings } from "@/lib/imoveis/model";
import { PropertyCard } from "./PropertyCard";
import { FilterPanel } from "./FilterPanel";
import { searchProperties, cities } from "@/lib/imoveis/repository";
import { slugify } from "@/lib/imoveis/model";
export async function PropertySearch({
  params,
  config,
  favoriteUser,
  cityHeading,
}: {
  params: URLSearchParams;
  config: Settings;
  favoriteUser?: string;
  cityHeading?: string;
}) {
  const result = await searchProperties(params, favoriteUser);
  if (result.page > 1 && !result.items.length) notFound();
  const locations = await cities();
  const select = (name: string, label: string, options: string[]) => (
    <label key={name}>
      {label}
      <select name={name} defaultValue={params.get(name) ?? ""}>
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  const number = (name: string, label: string) => (
    <label key={name}>
      {label}
      <input
        type="number"
        min="0"
        step="any"
        name={name}
        defaultValue={params.get(name) ?? ""}
      />
    </label>
  );
  const pageLink = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `${favoriteUser ? "/imoveis/favoritos" : "/imoveis"}?${next}`;
  };
  return (
    <>
      <section className="mb-8 rounded-3xl bg-brand-primary p-6 text-white sm:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-white/70">
          Um novo lugar para suas histórias
        </p>
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
          {favoriteUser
            ? "Seus imóveis favoritos"
            : (cityHeading ?? "Seu próximo endereço começa aqui.")}
        </h1>
        <p className="mt-4 max-w-xl text-white/80">
          Encontre imóveis para comprar, alugar ou passar uma temporada. Anuncie
          gratuitamente e converse direto com quem anuncia.
        </p>
      </section>
      <div className="grid items-start gap-7 lg:grid-cols-[260px_1fr]">
        <FilterPanel>
          <form
            className="estate-panel space-y-4"
            action={favoriteUser ? "/imoveis/favoritos" : "/imoveis"}
          >
            <p className="flex items-center gap-2 font-semibold">
              <Search size={18} /> Encontre seu imóvel
            </p>
            {select("purpose", "Finalidade", [...PURPOSES])}
            {select("state", "Estado", STATES)}
            <label>
              Cidade
              <input
                name="city"
                maxLength={100}
                defaultValue={params.get("city") ?? ""}
                placeholder="Ex.: São José dos Campos"
              />
            </label>
            <label>
              Bairro
              <input
                name="neighborhood"
                maxLength={100}
                defaultValue={params.get("neighborhood") ?? ""}
              />
            </label>
            {select("type", "Tipo de imóvel", config.types)}
            <div className="grid grid-cols-2 gap-2">
              {number("min", "Preço mínimo")}
              {number("max", "Preço máximo")}
            </div>
            {number("bedrooms", "Mínimo de quartos")}
            {number("parking", "Mínimo de vagas")}
            {number("area", "Área mínima (m²)")}
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                Características
              </summary>
              <div className="mt-3 space-y-3">
                {config.features.map((f) => (
                  <label key={f}>
                    <input
                      type="checkbox"
                      name="feature"
                      value={f}
                      defaultChecked={params.getAll("feature").includes(f)}
                    />
                    {f}
                  </label>
                ))}
              </div>
            </details>
            <input
              type="hidden"
              name="sort"
              value={params.get("sort") ?? "recent"}
            />
            <button className="estate-button w-full">Buscar imóveis</button>
            <Link
              href={favoriteUser ? "/imoveis/favoritos" : "/imoveis"}
              className="block text-center text-sm text-brand-primary underline"
            >
              Limpar filtros
            </Link>
          </form>
        </FilterPanel>
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              {result.total}{" "}
              {result.total === 1 ? "imóvel encontrado" : "imóveis encontrados"}
            </p>
            <form
              className="flex items-center gap-2"
              action={favoriteUser ? "/imoveis/favoritos" : "/imoveis"}
            >
              {[...params]
                .filter(([k]) => k !== "sort" && k !== "page")
                .map(([k, v], i) => (
                  <input key={i} type="hidden" name={k} value={v} />
                ))}
              <select
                aria-label="Ordenar imóveis"
                name="sort"
                defaultValue={params.get("sort") ?? "recent"}
              >
                <option value="recent">Mais recentes</option>
                <option value="price">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="area">Maior área</option>
              </select>
              <button className="estate-button secondary">Ordenar</button>
            </form>
          </div>
          {result.items.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          ) : (
            <div className="estate-panel flex flex-col items-center gap-4 py-16 text-center">
              <House size={42} className="text-brand-primary" />
              <h2 className="text-xl font-semibold">
                {favoriteUser
                  ? "Você ainda não salvou imóveis com estes filtros."
                  : "Nenhum imóvel encontrado por aqui."}
              </h2>
              <p className="max-w-md text-sm text-zinc-500">
                Ajuste os filtros ou seja a primeira pessoa a anunciar na sua
                região.
              </p>
              <Link className="estate-button" href="/imoveis/anunciar">
                Anunciar meu imóvel
              </Link>
            </div>
          )}
          <nav
            aria-label="Paginação"
            className="mt-7 flex items-center justify-center gap-4"
          >
            {result.page > 1 && (
              <Link
                className="estate-button secondary"
                href={pageLink(result.page - 1)}
              >
                ← Anterior
              </Link>
            )}
            <span className="text-sm">Página {result.page}</span>
            {result.page * 12 < result.total && (
              <Link
                className="estate-button secondary"
                href={pageLink(result.page + 1)}
              >
                Próxima →
              </Link>
            )}
          </nav>
        </section>
      </div>
      {!!locations.length && !favoriteUser && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Explore cidades com imóveis
          </h2>
          <div className="flex flex-wrap gap-3">
            {locations.map((c) => (
              <Link
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-brand-primary"
                key={`${c.state}-${c.city}`}
                href={`/imoveis/cidade/${c.state.toLowerCase()}/${slugify(c.city)}`}
              >
                {c.city} / {c.state} ({c.total})
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
