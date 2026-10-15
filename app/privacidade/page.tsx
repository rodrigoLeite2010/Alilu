import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Política de Privacidade",
  description: `Como o ${SITE_NAME} trata dados nas ferramentas, contas, uploads, inteligência artificial, cookies e publicidade.`,
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
        Última atualização: 15 de outubro de 2026.
      </p>

      <div className="legal-content mt-6">
        <h2>Dados informados nas calculadoras</h2>
        <p>
          As calculadoras e conversores identificados como locais processam os
          dados no seu navegador, sem enviar os valores ou arquivos aos servidores
          Alilu. Essa descrição não se aplica aos recursos que salvam dados da
          conta, processam vídeos remotamente, importam conteúdo ou usam IA.
          Consulte a indicação da ferramenta antes de enviar conteúdo.
        </p>

        <h2>Cookies e estatísticas de acesso</h2>
        <p>
          Nas calculadoras locais, os valores ficam na memória da página durante
          o uso. Cookies de sessão permitem manter sua conta conectada. Para
          entender quantas pessoas usam o {SITE_NAME} e quais
          páginas são mais úteis, usamos a ferramenta de estatísticas PostHog,
          que grava um identificador de navegação no cookie/armazenamento local do
          seu navegador. Registramos apenas as páginas visitadas (sem
          parâmetros da URL), a origem da visita e, se você estiver logado,
          o identificador interno da sua conta. Esse identificador fica associado
          à conta, portanto não deve ser entendido como dado anônimo. A configuração
          de estatísticas desativa captura automática de campos, cliques e gravação
          de sessão; ela não envia os textos e arquivos preenchidos nas ferramentas.
          Você pode apagar cookies e armazenamento local nas configurações do navegador;
          isso pode encerrar sua sessão e não exclui os dados salvos na conta.
        </p>

        <h2>Conta e informações salvas</h2>
        <p>
          Ao entrar com Google ou código por e-mail, usamos os dados de identificação
          da conta, como e-mail, nome e identificador interno, para autenticação e
          funcionamento dos recursos. Dados que você salva no orçamento financeiro,
          agenda, mesada, amigo secreto, jogos de loteria, publicações e automações são armazenados
          nos serviços da plataforma e associados ao respectivo recurso ou conta.
          Eles não são descartados simplesmente ao fechar o navegador.
        </p>

        <h2>Arquivos, importações e processamento com IA</h2>
        <p>
          O editor split-screen envia os vídeos para processamento no servidor;
          os arquivos de entrada são removidos após o processamento, conforme
          explicado no editor. Importações do Instagram, mídias da conta e resultados
          gerados podem ser armazenados para edição, download, publicação e histórico.
          O armazenamento e processamento usam provedores de infraestrutura, incluindo
          Vercel Blob nos recursos de mídia.
        </p>
        <p>
          Ao solicitar uma geração ou reescrita com IA, os textos, imagens ou instruções
          necessários são enviados ao servidor Alilu e ao provedor de IA usado pelo
          recurso. A geração de imagem para vídeo utiliza Runway; os recursos de texto
          utilizam o provedor configurado pela plataforma. A análise local de legibilidade
          não exige esse envio; a opção Melhorar com IA exige. Não envie senhas,
          documentos confidenciais ou dados sensíveis nesses pedidos.
        </p>

        <h2>Planos, créditos e registros de uso</h2>
        <p>
          Recursos pagos mantêm informações de plano, saldo de créditos, consumo e
          transações necessárias para liberar e acompanhar o serviço. O pagamento
          pode envolver um provedor externo, conforme o fluxo apresentado na compra.
          Os serviços de autenticação, envio de e-mail, hospedagem, armazenamento,
          pagamento, IA e publicação recebem os dados necessários às suas funções.
        </p>

        <h2>Dados técnicos de hospedagem</h2>
        <p>
          Como qualquer site na internet, a infraestrutura que hospeda o{" "}
          {SITE_NAME} pode registrar dados técnicos básicos de acesso (como
          endereço IP, data/hora da visita e páginas acessadas) para fins de
          segurança e funcionamento do serviço.
        </p>

        <h2>Publicidade</h2>
        <p>
          O site integra o script do Google AdSense para publicidade. O carregamento
          desse código não significa que haverá anúncios em todas as páginas. O Google
          pode usar cookies e identificadores para veicular, medir e personalizar
          anúncios, de acordo com suas configurações e políticas. Consulte{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">como o Google usa informações de sites parceiros</a>
          {" "}e as <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">preferências de anúncios do Google</a>.
        </p>

        <h2>Conta do Instagram conectada</h2>
        <p>
          Se você conectar uma conta profissional do Instagram para agendar e
          publicar conteúdo, o {SITE_NAME} recebe da Meta, com a sua
          autorização, o identificador e o @usuário da conta e um token de
          acesso, guardado cifrado nos nossos servidores. Usamos esses dados
          somente para publicar posts, carrosséis, Reels e Stories que você
          criar ou agendar no {SITE_NAME}. Esses pedidos de publicação são enviados
          à Meta. A conexão não é usada para ler mensagens, comentários ou seguidores.
          Você pode desconectar a qualquer momento (o token é apagado
          na hora) — veja <a href="/exclusao-de-dados">Exclusão de dados</a>.
        </p>

        <h2>Seus direitos e contato</h2>
        <p>
          Para pedir informações, correção ou exclusão de dados da sua conta,
          ou esclarecer dúvidas sobre o tratamento de dados, escreva para{" "}
          <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a>,
          nosso único canal de contato oficial. A exclusão da conta e dos dados
          associados pode ser solicitada conforme as <a href="/exclusao-de-dados">instruções de exclusão</a>.
          Dados de conta e histórico permanecem disponíveis enquanto necessários
          ao funcionamento dos recursos; a remoção de cookies não os apaga.
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
