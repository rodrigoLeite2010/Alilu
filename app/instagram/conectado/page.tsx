import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleAlert, CircleX, Info } from "lucide-react";
import { auth } from "@/auth";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { sanitizeOAuthReturnPath } from "@/lib/instagram/backend/oauth-state";
import { ConnectInstagramLink } from "@/components/instagram/ConnectInstagramLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conexão com o Instagram | Alilu", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ resultado?: string; continuar?: string }>;
}

/** Acrescenta ?status=conectado (as telas de criação usam isso para restaurar o rascunho). */
function continueHref(path: string | null): string {
  const url = new URL(path ?? "/instagram/painel", "https://alilu.invalid");
  url.searchParams.set("status", "conectado");
  return `${url.pathname}${url.search}`;
}

const BUTTON = "flex h-12 w-full items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-base font-semibold text-white hover:opacity-90";
const SECONDARY = "flex h-12 w-full items-center justify-center rounded-md border border-zinc-300 px-4 text-base font-semibold text-zinc-800 hover:bg-zinc-50";

/**
 * Tela de resultado do login do Instagram (sempre no alilu.com.br, nunca
 * parada no instagram.com). Responsiva, pensada primeiro para o celular.
 * Nenhuma mensagem técnica da Meta aparece aqui — só no log do servidor.
 */
export default async function InstagramConnectionResultPage({ searchParams }: PageProps) {
  const { resultado = "erro", continuar } = await searchParams;
  const returnTo = sanitizeOAuthReturnPath(continuar);
  const session = await auth();
  const account = session?.user?.id && resultado === "sucesso" ? await getInstagramAccountForUser(session.user.id) : null;

  let icon = <CircleAlert className="h-12 w-12 text-red-600" aria-hidden />;
  let title = "Não foi possível conectar o Instagram";
  let body: React.ReactNode = (
    <p>Algo deu errado na conexão com o Instagram. Tente novamente em alguns instantes. Se continuar, fale com a gente pelo contato do site.</p>
  );
  let actions: React.ReactNode = (
    <>
      <ConnectInstagramLink returnTo={returnTo} label="Tentar novamente" className={BUTTON} />
      <Link href="/instagram/painel" className={SECONDARY}>
        Voltar
      </Link>
    </>
  );

  if (resultado === "sucesso") {
    icon = <CheckCircle2 className="h-12 w-12 text-teal-600" aria-hidden />;
    title = "Instagram conectado com sucesso";
    body = (
      <>
        {account?.igUsername ? <p className="text-lg font-semibold text-zinc-900">@{account.igUsername}</p> : null}
        <p>Agora o Alilu pode realizar suas postagens automaticamente.</p>
      </>
    );
    actions = (
      <Link href={continueHref(returnTo)} className={BUTTON}>
        Continuar
      </Link>
    );
  } else if (resultado === "cancelado") {
    icon = <CircleX className="h-12 w-12 text-zinc-500" aria-hidden />;
    title = "Conexão com Instagram cancelada";
    body = <p>Nada foi alterado. Quando quiser, é só tentar de novo — leva menos de um minuto.</p>;
  } else if (resultado === "conta-nao-profissional") {
    icon = <Info className="h-12 w-12 text-amber-600" aria-hidden />;
    title = "Sua conta precisa ser profissional";
    body = (
      <>
        <p>
          Sua conta precisa ser uma conta profissional do Instagram (Criador ou Empresa) para utilizar as postagens automáticas do Alilu. É
          gratuito e leva poucos segundos:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-left">
          <li>Abra o Instagram e vá ao seu perfil.</li>
          <li>
            Toque em <strong>☰ Menu › Configurações e privacidade</strong>.
          </li>
          <li>
            Entre em <strong>Tipo de conta e ferramentas</strong>.
          </li>
          <li>
            Toque em <strong>Mudar para conta profissional</strong> e escolha Criador ou Empresa.
          </li>
        </ol>
        <p className="mt-3">Depois volte aqui e toque em “Tentar novamente”.</p>
      </>
    );
  } else if (resultado === "sem-permissao") {
    icon = <Info className="h-12 w-12 text-amber-600" aria-hidden />;
    title = "Falta a permissão de publicar";
    body = (
      <p>
        Na tela do Instagram, a opção de <strong>publicar conteúdo</strong> ficou desmarcada. Sem ela o Alilu não consegue fazer suas
        postagens. Toque em “Tentar novamente” e mantenha todas as opções marcadas.
      </p>
    );
  } else if (resultado === "meta-review") {
    icon = <Info className="h-12 w-12 text-amber-600" aria-hidden />;
    title = "Integração em análise pela Meta";
    body = (
      <p>
        Esta conta ainda não pode ser conectada enquanto a integração da Meta está em análise, ou enquanto a conta não estiver autorizada
        no app da Meta. Nenhuma configuração foi alterada no Alilu.
      </p>
    );
  } else if (resultado === "sessao") {
    icon = <Info className="h-12 w-12 text-amber-600" aria-hidden />;
    title = "Entre no Alilu para concluir";
    body = (
      <p>
        O Instagram devolveu você para um navegador em que você não está logado no Alilu. Entre na sua conta do Alilu neste navegador e toque
        em “Conectar Instagram” de novo.
      </p>
    );
    actions = (
      <>
        <Link href={`/entrar?callbackUrl=${encodeURIComponent(returnTo ?? "/instagram/painel")}`} className={BUTTON}>
          Entrar no Alilu
        </Link>
      </>
    );
  } else if (resultado === "expirado") {
    icon = <Info className="h-12 w-12 text-amber-600" aria-hidden />;
    title = "A conexão demorou demais";
    body = <p>Por segurança, o pedido de conexão vale por 10 minutos. Toque em “Tentar novamente”.</p>;
  } else if (resultado === "indisponivel") {
    title = "Conexão com o Instagram indisponível no momento";
    body = <p>Estamos ajustando a integração com o Instagram. Tente novamente mais tarde.</p>;
    actions = (
      <Link href="/instagram/painel" className={SECONDARY}>
        Voltar
      </Link>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-4 py-10 text-center">
      {icon}
      <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      <div className="space-y-2 text-base text-zinc-700">{body}</div>
      <div className="flex w-full flex-col gap-3">{actions}</div>
    </main>
  );
}
