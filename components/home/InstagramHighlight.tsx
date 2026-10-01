import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { instagramTools, INSTAGRAM_CATEGORY, INSTAGRAM_PUBLISHING, CONTENT_AUTOMATION } from "@/data/instagram";

/**
 * Destaque "Crie e automatize seu Instagram" — lê os dados reais de
 * data/instagram.ts (nenhuma ferramenta ou rota inventada aqui). Deixa
 * claro, sem esconder, que publicar/agendar direto no Instagram exige
 * conectar a conta — a criação e o download continuam grátis e sem login.
 */
export function InstagramHighlight() {
  const publishingLinks = [
    { href: INSTAGRAM_PUBLISHING.schedulePath, label: "Calendário de conteúdo" },
    { href: CONTENT_AUTOMATION.dashboardPath, label: "Piloto Automático" },
    { href: INSTAGRAM_PUBLISHING.viralPostsPath, label: "Posts Virais" },
  ];

  return (
    <section className="border-b border-brand-primary/10 bg-white">
      <Container className="py-12 sm:py-16">
        <div className="rounded-xl border border-brand-primary/15 bg-gradient-to-br from-brand-primary-soft/70 to-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent-dark">
                {INSTAGRAM_CATEGORY.name}
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                Crie e automatize seu Instagram
              </h2>
              <p className="mt-3 text-zinc-600">
                Crie posts, carrosséis, legendas e agende suas publicações diretamente pelo Alilu.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Criar e baixar é grátis e sem login. Para publicar ou agendar direto no Instagram (uma conta ou
                várias), é preciso conectar sua conta.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href={INSTAGRAM_CATEGORY.path}>Conhecer ferramentas para Instagram</LinkButton>
                <LinkButton href={INSTAGRAM_PUBLISHING.connectPath} variant="secondary">
                  Conectar Instagram
                </LinkButton>
              </div>
            </div>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[19rem]">
              {instagramTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={tool.path}
                    className="flex h-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:border-brand-primary/40 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                  >
                    <Icon name={tool.icon} className="h-4 w-4 shrink-0 text-brand-primary" />
                    {tool.shortName}
                  </Link>
                </li>
              ))}
              {publishingLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex h-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:border-brand-primary/40 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                  >
                    <Icon name="calendar" className="h-4 w-4 shrink-0 text-brand-primary" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
