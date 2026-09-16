import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { categories } from "@/data/categories";
import { SITE_NAME } from "@/lib/seo/site";

const legalLinks = [
  { href: "/sobre", label: "Sobre" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos-de-uso", label: "Termos de Uso" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {SITE_NAME}
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Calculadoras e utilitários gratuitos para o seu dia a dia.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Categorias
          </p>
          <ul className="mt-3 space-y-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/utilitarios/${category.id}`}
                  className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Utilitários
          </p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                href="/utilitarios"
                className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Todas as ferramentas
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Institucional
          </p>
          <ul className="mt-3 space-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-zinc-200 py-4 dark:border-zinc-800">
        <Container>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            © {year} {SITE_NAME}. Todos os direitos reservados.
          </p>
        </Container>
      </div>
    </footer>
  );
}
