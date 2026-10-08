"use client";

import { trackLogoutAndReset } from "@/lib/analytics/posthog-client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Icon } from "@/components/ui/Icon";
import type { HeaderUser } from "./auth-state";

/**
 * Menu de conta no cabeçalho — visível em todo o site quando o usuário
 * está logado (ver components/layout/Header.tsx). Deixa claro, o tempo
 * todo, que existe uma sessão ativa e com qual conta, e é o único lugar do
 * site (junto de /minha-conta) com um botão "Sair" de verdade.
 */
export function UserMenu({ user }: { user: HeaderUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  const displayName = user.name?.trim() || user.email;
  const firstName = displayName.split(" ")[0];

  useEffect(() => {
    if (!open) return;

    firstItemRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    await trackLogoutAndReset();
    await signOut({ callbackUrl: "/?saiu=1" });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="menu-conta"
        className="flex h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar externo (Google); o projeto não usa next/image em nenhum outro lugar.
          <img
            src={user.image}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary">
            <Icon name="user" className="h-4 w-4" />
          </span>
        )}
        <span className="hidden max-w-[8rem] truncate sm:inline">{firstName}</span>
        <Icon name="chevron-down" className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      {open ? (
        <div
          id="menu-conta"
          role="menu"
          aria-label="Menu da conta"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg"
        >
          <div className="border-b border-zinc-100 px-4 py-2">
            <p className="truncate text-sm font-medium text-zinc-900">{displayName}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <div role="none" className="py-1">
            <Link
              ref={firstItemRef}
              href="/minha-conta"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Minha conta
            </Link>
            <Link
              href="/planos"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Planos e assinatura
            </Link>
            <Link
              href="/financeiro/educacao-financeira"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Controle financeiro
            </Link>
            <Link
              href="/instagram/painel"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center px-4 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Instagram / Automações
            </Link>
            {user.isAdmin ? (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center px-4 text-sm font-medium text-teal-800 hover:bg-zinc-50"
              >
                Admin
              </Link>
            ) : null}
          </div>
          <div role="none" className="border-t border-zinc-100 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex min-h-10 w-full items-center gap-2 px-4 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
            >
              <Icon name="log-out" className="h-4 w-4" />
              {signingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
