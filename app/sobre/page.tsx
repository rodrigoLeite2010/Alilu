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
          As calculadoras e os utilitários públicos podem ser usados sem cadastro.
          Eles ajudam a calcular, converter arquivos, preparar documentos e revisar
          textos. Cada página explica o que o resultado significa e as limitações
          do processamento. Nas ferramentas locais, os dados ficam no navegador.
        </p>
        <h2>Recursos com conta e serviços pagos</h2>
        <p>
          Orçamento pessoal, agenda e recursos de publicação usam uma conta para
          guardar seus dados e permitir que você volte a eles. Alguns recursos de
          Instagram e inteligência artificial dependem de plano, cotas ou créditos.
          Confira as condições mostradas na ferramenta e em <a href="/planos">Planos</a>
          antes de usar. Serviços de processamento remoto enviam os dados necessários
          aos servidores e provedores envolvidos, conforme a <a href="/privacidade">Política de Privacidade</a>.
        </p>
        <h2>Como avaliar os resultados</h2>
        <p>
          Simulações financeiras e trabalhistas são referências para comparação,
          não propostas de crédito nem orientação profissional individual.
          Conversões de documentos podem perder formatação. Se encontrar um erro,
          informe a ferramenta, o comportamento esperado e os passos para reproduzir,
          sem enviar senhas ou documentos sensíveis.
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
