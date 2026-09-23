"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "./Dialog";

/**
 * Etapa "Conecte seu Instagram para continuar" — só aparece quando a
 * pessoa clica em publicar/agendar. Explica que criar continua grátis e
 * sem login e o que vai acontecer (login no Alilu → tela oficial da Meta →
 * volta para a mesma arte).
 */
export function ConnectInstagramDialog({
  open,
  authenticated,
  needsReconnect = false,
  onClose,
  onConnect,
}: {
  open: boolean;
  authenticated: boolean;
  needsReconnect?: boolean;
  onClose: () => void;
  onConnect: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={needsReconnect ? "Renove a conexão com o Instagram" : "Conecte seu Instagram para continuar"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Continuar editando
          </Button>
          <Button type="button" onClick={onConnect}>
            {authenticated ? "Conectar Instagram" : "Entrar e conectar Instagram"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">
        Você só precisa conectar sua conta quando quiser publicar ou agendar. A criação das artes continua gratuita e sem
        login.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        {!authenticated ? <li>Entre no Alilu com Google ou com um código por e-mail.</li> : null}
        <li>Autorize o Alilu na tela oficial do Instagram (Meta).</li>
        <li>Você volta para esta arte, com tudo como deixou, e escolhe publicar agora ou agendar.</li>
      </ol>
      <p className="text-xs text-zinc-500">
        É preciso uma conta profissional do Instagram (Criador de conteúdo ou Empresa). O Alilu nunca vê a sua senha do
        Instagram.
      </p>
    </Dialog>
  );
}

/** Destino do botão de conexão: sem login, entra no Alilu e segue direto para a Meta; depois volta para `returnPath`. */
export function buildConnectTarget(authenticated: boolean, returnPath: string): string {
  const oauth = `/api/instagram/oauth/start?returnTo=${encodeURIComponent(returnPath)}`;
  return authenticated ? oauth : `/entrar?callbackUrl=${encodeURIComponent(oauth)}`;
}
