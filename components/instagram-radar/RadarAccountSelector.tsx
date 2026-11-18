"use client";

import { useEffect, useState } from "react";

export interface RadarAccountOptionDto {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
  status: string;
  authProvider: string;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  BUSINESS: "Empresa",
  MEDIA_CREATOR: "Criador de conteúdo",
  CREATOR: "Criador de conteúdo",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectada",
  expired: "Conexão expirada",
  revoked: "Desconectada",
  error: "Com erro",
};

export function accountTypeLabel(type: string | null): string {
  if (!type) return "Tipo não informado pela Meta";
  return ACCOUNT_TYPE_LABEL[type] ?? type;
}

/** Contas conectadas do usuário logado (servidor já filtra; nunca devolve token). */
export function useRadarAccounts() {
  const [accounts, setAccounts] = useState<RadarAccountOptionDto[] | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/instagram-radars/accounts", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { accounts: RadarAccountOptionDto[]; needsReconnect: number };
      })
      .then((data) => {
        if (cancelled) return;
        setAccounts(data.accounts);
        setNeedsReconnect(data.needsReconnect);
      })
      .catch(() => {
        if (cancelled) return;
        setAccounts([]);
        setError("Não foi possível carregar suas contas do Instagram.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { accounts, needsReconnect, error };
}

function Avatar({ account }: { account: RadarAccountOptionDto }) {
  if (account.profilePictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- foto de perfil vinda da Meta (CDN externo).
    return <img src={account.profilePictureUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  const initial = (account.name ?? account.username ?? "?").slice(0, 1).toUpperCase();
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">{initial}</span>;
}

/**
 * Seletor de conta de destino. Nada vem pré-selecionado (nem com uma única
 * conta): a pessoa precisa escolher. Em edição, a conta do radar é fixa.
 */
export function RadarAccountSelector({
  accounts,
  needsReconnect,
  value,
  onChange,
  locked = false,
}: {
  accounts: RadarAccountOptionDto[] | null;
  needsReconnect: number;
  value: string;
  onChange: (id: string) => void;
  locked?: boolean;
}) {
  if (accounts === null) return <p className="text-sm text-zinc-500">Carregando contas…</p>;
  if (accounts.length === 0) {
    return (
      <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        Nenhuma conta do Instagram conectada.{" "}
        <a className="font-medium underline" href="/instagram/painel">
          Conectar conta
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Conta do Instagram de destino">
      {accounts.map((account) => {
        const selected = account.id === value;
        return (
          <label
            key={account.id}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${selected ? "border-teal-600 bg-teal-50" : "border-zinc-200 bg-white"} ${locked && !selected ? "hidden" : ""}`}
          >
            <input
              type="radio"
              name="radar-account"
              className="h-4 w-4"
              checked={selected}
              disabled={locked && !selected}
              onChange={() => onChange(account.id)}
              aria-label={`@${account.username ?? account.id}`}
            />
            <Avatar account={account} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-zinc-900">{account.name ?? account.username ?? "Conta sem nome"}</span>
              <span className="block truncate text-xs text-zinc-600">@{account.username ?? "?"}</span>
            </span>
            <span className="text-right text-xs">
              <span className={`block font-medium ${account.status === "connected" ? "text-teal-800" : "text-amber-700"}`}>{STATUS_LABEL[account.status] ?? account.status}</span>
              <span className="block text-zinc-500">{accountTypeLabel(account.accountType)}</span>
            </span>
          </label>
        );
      })}
      {needsReconnect > 0 ? (
        <p className="text-xs text-zinc-500">
          {needsReconnect} conta(s) precisam ser reconectadas e não aparecem aqui.{" "}
          <a className="underline" href="/instagram/painel">
            Ver contas
          </a>
        </p>
      ) : null}
    </div>
  );
}
