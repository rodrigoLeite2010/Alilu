"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { createInstagramLinks, videoLinks, type MobileLink } from "@/components/mobile/mobile-links";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const itemClasses =
  "relative flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-accent";

const leftItems: NavItem[] = [{ href: "/", label: "Início", icon: "home" }];
const rightItems: NavItem[] = [
  { href: "/instagram", label: "Instagram", icon: "instagram" },
  { href: "/agenda", label: "Agenda", icon: "calendar" },
  { href: "/minha-conta", label: "Perfil", icon: "user" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CreateGroup({ title, links, onNavigate }: { title: string; links: MobileLink[]; onNavigate: () => void }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <ul className="grid gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              className="flex min-h-16 items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors active:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-primary-soft text-brand-primary">
                <Icon name={link.icon} className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-zinc-900">{link.label}</span>
                {link.description ? <span className="block text-sm text-zinc-600">{link.description}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`${itemClasses} ${active ? "font-semibold text-brand-primary" : "text-zinc-600 active:bg-zinc-100"}`}
      >
        {/* Indicador no topo: o item ativo não depende só da cor. */}
        <span aria-hidden className={`absolute inset-x-5 top-0 h-0.5 rounded-b ${active ? "bg-brand-primary" : "bg-transparent"}`} />
        <Icon name={item.icon} className="h-6 w-6" />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

/**
 * Barra inferior fixa do celular (< 768px): Início, Criar, Instagram,
 * Agenda e Perfil. "Criar" abre um bottom sheet em vez de navegar.
 * Respeita a safe area do iPhone; o <body> reserva o mesmo espaço (ver
 * app/layout.tsx) para a barra nunca cobrir conteúdo.
 */
export function MobileBottomNavigation() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-primary/15 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <ul className="grid grid-cols-5">
          {leftItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={createOpen}
              className={`${itemClasses} text-brand-primary`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm">
                <Icon name="plus" className="h-5 w-5" />
              </span>
              <span className="font-semibold">Criar</span>
            </button>
          </li>
          {rightItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>

      <MobileBottomSheet open={createOpen} onClose={closeCreate} title="O que você quer criar?">
        <div className="space-y-5">
          <CreateGroup title="Vídeos" links={videoLinks} onNavigate={closeCreate} />
          <CreateGroup title="Instagram" links={createInstagramLinks} onNavigate={closeCreate} />
        </div>
      </MobileBottomSheet>
    </>
  );
}
