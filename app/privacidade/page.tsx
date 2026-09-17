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
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Última atualização: 17 de setembro de 2026.
      </p>

      <div className="legal-content mt-6">
        <h2>Dados informados nas calculadoras</h2>
        <p>
          Sempre que possível, as calculadoras do {SITE_NAME} processam os
          valores que você digita diretamente no seu navegador. Esses dados
          não são enviados nem armazenados em nossos servidores.
        </p>

        <h2>Cookies</h2>
        <p>
          O {SITE_NAME} não utiliza cookies próprios de rastreamento nem
          armazena dados em cookies, localStorage ou sessionStorage do seu
          navegador. Os valores digitados nas calculadoras ficam apenas na
          memória da página enquanto você a utiliza e são descartados ao
          fechá-la ou atualizá-la.
        </p>

        <h2>Dados técnicos de hospedagem</h2>
        <p>
          Como qualquer site na internet, a infraestrutura que hospeda o{" "}
          {SITE_NAME} pode registrar dados técnicos básicos de acesso (como
          endereço IP, data/hora da visita e páginas acessadas) para fins de
          segurança e funcionamento do serviço. O {SITE_NAME} não utiliza,
          nesta fase, nenhuma ferramenta própria de análise de audiência
          (como Google Analytics) nem identificador de publicidade ativo.
        </p>

        <h2>Publicidade</h2>
        <p>
          O {SITE_NAME} pode, no futuro, exibir anúncios (por exemplo, via
          Google AdSense) para manter as ferramentas gratuitas. Nenhum
          anúncio real está ativo no momento. Quando isso acontecer, esta
          política será atualizada com as informações específicas sobre os
          parceiros de publicidade utilizados e os cookies que passarem a ser
          usados por eles.
        </p>

        <h2>Seus direitos e contato</h2>
        <p>
          Dúvidas sobre o tratamento de dados nesta plataforma podem ser
          enviadas para o e-mail{" "}
          <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a>,
          nosso único canal de contato oficial.
        </p>

        <h2>Atualizações desta política</h2>
        <p>
          Esta política pode ser atualizada conforme a plataforma evolui —
          por exemplo, quando novos recursos de publicidade ou análise forem
          efetivamente ativados. A versão mais recente estará sempre
          disponível nesta página.
        </p>
      </div>
    </Container>
  );
}
