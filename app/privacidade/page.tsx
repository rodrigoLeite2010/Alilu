import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Política de Privacidade",
  description: `Como o ${SITE_NAME} trata os dados preenchidos nas calculadoras e utilitários do site.`,
  path: "/privacidade",
});

export default function PrivacyPolicyPage() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Política de Privacidade", path: "/privacidade" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
        Última atualização: esta é uma versão inicial, publicada junto com o
        lançamento da plataforma.
      </p>

      <div className="legal-content mt-6">
        <h2>Dados informados nas calculadoras</h2>
        <p>
          Sempre que possível, as calculadoras do {SITE_NAME} processam os
          valores que você digita diretamente no seu navegador. Esses dados
          não são enviados nem armazenados em nossos servidores.
        </p>

        <h2>Dados de navegação</h2>
        <p>
          Como a maioria dos sites, podemos coletar dados básicos de acesso
          (como páginas visitadas e tipo de dispositivo) para entender o uso
          da plataforma e melhorar as ferramentas oferecidas. Nenhum
          identificador de análise ou publicidade está ativo nesta fase do
          projeto.
        </p>

        <h2>Publicidade</h2>
        <p>
          O {SITE_NAME} pode, no futuro, exibir anúncios (por exemplo, via
          Google AdSense) para manter as ferramentas gratuitas. Quando isso
          acontecer, esta política será atualizada com as informações
          específicas sobre os parceiros de publicidade utilizados.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode entrar em contato pelo e-mail{" "}
          <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a> para
          esclarecer dúvidas sobre o tratamento de dados nesta plataforma.
        </p>
      </div>
    </Container>
  );
}
