import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CategoryCard } from "@/components/tools/CategoryCard";
import { categories } from "@/data/categories";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";

/**
 * Grade de categorias da Home. Extraído de app/page.tsx sem alterar a
 * estrutura (o card de Instagram continua sendo o primeiro item, na mesma
 * marcação) — __tests__/components/HomepageCategories.test.tsx depende
 * disso.
 *
 * Retorna só o <div> da grade (sem nenhum wrapper a mais): o chamador
 * (app/page.tsx) é quem decide o que vem antes/depois no DOM.
 */
export function CategoryGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Categoria "Instagram e Redes Sociais": vive em /instagram (fora
          de /utilitarios/[categoria], ver data/instagram.ts), então usa
          o mesmo visual do CategoryCard só que montado aqui à mão.
          Aparece primeiro na lista de categorias. */}
      <Link
        href={INSTAGRAM_CATEGORY.path}
        className="group flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-teal-50 group-hover:text-teal-800">
          <Icon name={INSTAGRAM_CATEGORY.icon} className="h-5 w-5" />
        </span>
        <div>
          <p className="text-lg font-semibold text-zinc-900 group-hover:text-teal-800">
            {INSTAGRAM_CATEGORY.name}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{INSTAGRAM_CATEGORY.description}</p>
        </div>
        <p className="mt-auto text-xs font-medium text-zinc-500">
          {instagramTools.length} {instagramTools.length === 1 ? "ferramenta" : "ferramentas"}
        </p>
      </Link>
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
