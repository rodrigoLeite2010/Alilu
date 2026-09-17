import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Contato",
  description: `Fale com o ${SITE_NAME} por e-mail para dúvidas, sugestões de novas ferramentas ou relatos de problemas.`,
  path: "/contato",
});

export default function ContactPage() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Contato", path: "/contato" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Contato
      </h1>

      <div className="legal-content mt-6">
        <p>
          Dúvidas, sugestões de novas ferramentas ou relatos de problemas nas
          calculadoras e utilitários do {SITE_NAME} podem ser enviados a
          qualquer momento pelo e-mail{" "}
          <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a>.
        </p>
        <p>
          Esse é o único canal de contato oficial do {SITE_NAME} no momento.
          Sempre que possível, respondemos com atenção a cada mensagem
          recebida.
        </p>
      </div>
    </Container>
  );
}
