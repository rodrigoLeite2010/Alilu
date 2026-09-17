"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { categories } from "@/data/categories";

type NavigationLink = {
  href: string;
  label: string;
  icon: string;
};

const catalogLinks: NavigationLink[] = [
  { href: "/", label: "Início", icon: "home" },
  { href: "/utilitarios", label: "Todas as ferramentas", icon: "wrench" },
];

const categoryLinks: NavigationLink[] = categories.map((category) => ({
  href: `/utilitarios/${category.id}`,
  label: category.name,
  icon: category.icon,
}));

function isActiveLink(pathname: string, href: string) {
  if (href === "/" || href === "/utilitarios") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationItem({
  link,
  pathname,
  onNavigate,
}: {
  link: NavigationLink;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = isActiveLink(pathname, link.href);

  return (
    <li>
      <Link
        href={link.href}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
        className={`group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
          isActive
            ? "bg-teal-50 text-teal-900"
            : "text-zinc-600 hover:bg-white hover:text-zinc-950"
        }`}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            isActive
              ? "bg-teal-100 text-teal-800"
              : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200 group-hover:text-zinc-800"
          }`}
        >
          <Icon name={link.icon} className="h-4 w-4" />
        </span>
        <span className="min-w-0 truncate">{link.label}</span>
      </Link>
    </li>
  );
}

function NavigationList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <ul className="space-y-1">
        {catalogLinks.map((link) => (
          <NavigationItem
            key={link.href}
            link={link}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      <div className="my-5 border-t border-zinc-200" />
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Categorias
      </p>
      <ul className="mt-2 space-y-1">
        {categoryLinks.map((link) => (
          <NavigationItem
            key={link.href}
            link={link}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </>
  );
}

export function SiteSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-zinc-50/80 xl:block print:hidden">
      <nav
        aria-label="Navegação principal"
        className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-3 py-5"
      >
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Navegação
        </p>
        <div className="mt-3">
          <NavigationList pathname={pathname} />
        </div>
      </nav>
    </aside>
  );
}

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeNavigation = () => setOpen(false);

  return (
    <div className="xl:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label="Abrir menu de navegação"
        className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Fechar menu de navegação"
            className="absolute inset-0 bg-zinc-950/35"
            onClick={closeNavigation}
          />
          <nav
            ref={panelRef}
            id="menu-mobile"
            aria-label="Navegação principal"
            aria-modal="true"
            role="dialog"
            tabIndex={-1}
            className="relative flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto bg-white px-4 py-5 shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between px-2">
              <p className="text-sm font-semibold text-zinc-950">Menu</p>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeNavigation}
                aria-label="Fechar menu de navegação"
                className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5">
              <NavigationList pathname={pathname} onNavigate={closeNavigation} />
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
