"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { categories } from "@/data/categories";
import { Icon } from "@/components/ui/Icon";

const navLinks = [
  { href: "/utilitarios", label: "Todas as ferramentas" },
  ...categories.map((category) => ({
    href: `/utilitarios/${category.id}`,
    label: category.name,
  })),
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="relative">
      {/* Navegação desktop */}
      <nav aria-label="Navegação principal" className="hidden md:block">
        <ul className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-800"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Botão de menu mobile */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 md:hidden"
      >
        <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
      </button>

      {/* Navegação mobile */}
      {open ? (
        <nav
          id="menu-mobile"
          aria-label="Navegação principal (mobile)"
          className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg md:hidden"
        >
          <ul className="flex flex-col">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base text-zinc-700 hover:bg-zinc-100"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
