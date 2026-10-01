import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { DonationCard } from "@/components/donation/DonationCard";
import { categories } from "@/data/categories";
import { INSTAGRAM_CATEGORY } from "@/data/instagram";
import { SITE_NAME } from "@/lib/seo/site";

const legalLinks = [
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
  { href: "/sugestoes", label: "Sugestões" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/termos-de-uso", label: "Termos de Uso" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-primary/15 bg-white print:hidden">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- ativo local simples da identidade visual. */}
          <img src="/logo-banner.png" alt={SITE_NAME} width={240} height={60} className="h-11 w-auto max-w-[12rem]" />
          <p className="mt-2 text-sm text-zinc-600">
            Calculadoras e utilitários gratuitos para o seu dia a dia.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900">Categorias</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                href={INSTAGRAM_CATEGORY.path}
                className="text-sm text-zinc-600 hover:text-brand-primary hover:underline"
              >
                {INSTAGRAM_CATEGORY.name}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/utilitarios/${category.id}`}
                  className="text-sm text-zinc-600 hover:text-brand-primary hover:underline"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900">Utilitários</p>
          <ul className="mt-3 space-y-2">
            <li>
              <Link
                href="/utilitarios"
                className="text-sm text-zinc-600 hover:text-brand-primary hover:underline"
              >
                Todas as ferramentas
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900">Institucional</p>
          <ul className="mt-3 space-y-2">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-zinc-600 hover:text-brand-primary hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <div className="border-t border-brand-primary/10 bg-brand-primary-soft/40 py-6">
        <Container>
          <DonationCard />
        </Container>
      </div>

      <div className="border-t border-brand-primary/10 py-4">
        <Container>
          <p className="text-xs text-zinc-500">
            © {year} {SITE_NAME}. Todos os direitos reservados.
          </p>
        </Container>
      </div>
    </footer>
  );
}
