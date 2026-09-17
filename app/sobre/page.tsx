import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Sobre",
  description: `Conheça o ${SITE_NAME}, uma caixa de ferramentas online gratuita com calculadoras para trabalho, financeiro, empresa e utilidades do dia a dia.`,
  path: "/sobre",
});

export default function AboutPage() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Sobre", path: "/sobre" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Sobre o {SITE_NAME}
      </h1>

      <div className="legal-content mt-6">
        <p>
          O {SITE_NAME} é uma caixa de ferramentas online gratuita, criada
          para reunir calculadoras e utilitários do dia a dia em um só lugar:
          trabalho, financeiro, empresa e utilidades gerais.
        </p>
        <p>
          O objetivo é simples: entregar ferramentas rápidas, fáceis de usar
          no celular e sem custo, sem exigir cadastro. Sempre que possível,
          os cálculos são feitos diretamente no seu navegador — os dados que
          você digita não precisam ser enviados a nenhum servidor.
        </p>
        <p>
          A plataforma está em construção contínua: novas ferramentas são
          adicionadas por etapas, seguindo sempre a mesma organização por
          categorias para facilitar a navegação.
        </p>
        <h2>Contato</h2>
        <p>
          Dúvidas, sugestões de novas ferramentas ou relatos de problemas
          podem ser enviados para{" "}
          <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a>.
        </p>
      </div>
    </Container>
  );
}
