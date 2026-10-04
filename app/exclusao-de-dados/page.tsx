import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Exclusão de dados",
  description: `Como pedir a exclusão dos seus dados no ${SITE_NAME}, incluindo os dados da conta do Instagram conectada.`,
  path: "/exclusao-de-dados",
});

/**
 * Instruções de exclusão de dados — URL exigida pela Meta no app do
 * Instagram ("Data deletion instructions URL"). Ver docs/meta-instagram-production.md.
 */
export default function DataDeletionPage() {
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Exclusão de dados", path: "/exclusao-de-dados" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Exclusão de dados</h1>
      <div className="legal-content mt-6">
        <h2>Dados da conta do Instagram</h2>
        <p>
          Quando você conecta o Instagram, o {SITE_NAME} guarda apenas o identificador e o @usuário da conta profissional e um token de acesso
          (cifrado) que permite publicar o que você agendar. Não lemos mensagens, comentários nem seguidores.
        </p>
        <h2>Como apagar esses dados</h2>
        <ol>
          <li>
            Entre no {SITE_NAME}, abra <strong>Instagram › Painel</strong> e toque em <strong>Desconectar Instagram</strong>. O token de acesso é
            apagado na hora e nenhuma publicação é feita depois disso.
          </li>
          <li>
            Opcionalmente, no Instagram: <strong>Configurações › Segurança › Apps e sites</strong> e remova o acesso do {SITE_NAME}.
          </li>
          <li>
            Para apagar também a sua conta no {SITE_NAME} e todos os dados associados (publicações, mídias e automações), escreva para{" "}
            <a href="mailto:contato@alilu.com.br">contato@alilu.com.br</a> com o e-mail da sua conta. Atendemos em até 30 dias e confirmamos por
            e-mail.
          </li>
        </ol>
      </div>
    </Container>
  );
}
