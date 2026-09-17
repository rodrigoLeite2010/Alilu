import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Termos de Uso",
  description: `Condições de uso das calculadoras e utilitários gratuitos do ${SITE_NAME}.`,
  path: "/termos-de-uso",
});

export default function TermsOfUsePage() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Termos de Uso", path: "/termos-de-uso" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Termos de Uso
      </h1>

      <div className="legal-content mt-6">
        <h2>Uso gratuito</h2>
        <p>
          As ferramentas do {SITE_NAME} são oferecidas gratuitamente, sem
          necessidade de cadastro, para uso pessoal ou profissional.
        </p>

        <h2>Resultados são estimativas</h2>
        <p>
          Os resultados apresentados pelas calculadoras têm caráter
          informativo e devem ser tratados como estimativas. Eles não
          substituem a orientação de um contador, advogado ou profissional
          especializado para decisões financeiras, trabalhistas ou
          empresariais importantes.
        </p>

        <h2>Sem garantias</h2>
        <p>
          O {SITE_NAME} é oferecido &quot;como está&quot;, sem garantias de
          disponibilidade ininterrupta ou de ausência total de erros.
          Trabalhamos para manter as ferramentas corretas e atualizadas, mas
          recomendamos conferir resultados importantes antes de tomar
          decisões com base neles.
        </p>

        <h2>Alterações</h2>
        <p>
          Estes termos podem ser atualizados conforme novas ferramentas forem
          adicionadas à plataforma. A versão mais recente estará sempre
          disponível nesta página.
        </p>

        <h2>Contato</h2>
        <p>
          Dúvidas sobre estes termos podem ser enviadas para{" "}
          <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a>.
        </p>
      </div>
    </Container>
  );
}
