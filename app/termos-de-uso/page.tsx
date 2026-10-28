import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Termos de Uso",
  description: `Condições de uso das ferramentas públicas, contas e recursos com planos ou créditos do ${SITE_NAME}.`,
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
        <h2>Anúncios de imóveis</h2>
        <p>O cadastro inicial de imóveis é gratuito, sujeito aos limites apresentados no portal e à análise antes da publicação. A Alilu atua como plataforma de divulgação: não é imobiliária, não intermedeia transações, não recebe valores de imóveis e não garante titularidade, disponibilidade ou documentação. A aprovação editorial não constitui verificação do anúncio.</p>
        <p>Quem anuncia deve ter autorização para divulgar o imóvel e as fotos, fornecer informações verdadeiras e manter preço e disponibilidade atualizados. Corretores e imobiliárias devem informar sua identificação profissional e CRECI, sujeitos à conferência manual. Não inclua telefones, dados pessoais ou endereço residencial exato no título, descrição ou fotos. Imagens devem respeitar os direitos de terceiros.</p>
        <p>O anunciante autoriza o uso do WhatsApp para contato direto dos interessados. Anúncios têm validade de 90 dias após aprovação e podem ser reativados para nova análise. Anúncios fraudulentos, duplicados, abusivos ou impróprios podem ser rejeitados ou removidos e o anunciante pode ser suspenso. Use o botão de denúncia para solicitar análise. O anunciante pode editar, pausar e excluir seus anúncios no painel. Confira documentos e identidade das partes antes de negociar ou transferir valores.</p>
        <h2>Ferramentas públicas e recursos com conta</h2>
        <p>
          As calculadoras e os utilitários públicos do {SITE_NAME} são gratuitos
          e podem ser usados sem cadastro. Recursos que guardam dados da conta,
          publicam no Instagram ou utilizam serviços de IA podem exigir login,
          assinatura, cotas ou créditos. As condições e o custo aplicável são
          apresentados nas respectivas telas; consulte também <a href="/planos">Planos</a>.
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

        <h2>Uso adequado</h2>
        <p>
          As ferramentas devem ser utilizadas de forma lícita e de boa-fé.
          Não é permitido tentar sobrecarregar, explorar falhas ou utilizar o{" "}
          {SITE_NAME} para fins ilegais ou fraudulentos.
        </p>

        <h2>Dados e privacidade</h2>
        <p>
          O tratamento dos dados informados nas calculadoras segue a nossa{" "}
          <a href="/privacidade">Política de Privacidade</a>. Sempre que
          possível, os cálculos são feitos localmente no seu navegador, sem
          envio dos valores digitados para os nossos servidores.
        </p>
        <h2>Arquivos, publicações e inteligência artificial</h2>
        <p>
          Envie ou importe somente conteúdo próprio ou para o qual você tenha
          autorização de uso. Você é responsável por conferir textos, imagens,
          direitos de uso e informações antes de baixar, publicar ou agendar.
          Respostas de IA podem conter erros e precisam de revisão. A disponibilidade
          de processamento e publicação também depende dos serviços externos
          utilizados e das permissões da conta conectada.
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
