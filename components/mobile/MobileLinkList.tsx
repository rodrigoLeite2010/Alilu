import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { MobileLink } from "@/components/mobile/mobile-links";

/** Lista de atalhos em linhas largas (ícone, nome, descrição curta e seta): um toque por item. */
export function MobileLinkList({ items, label }: { items: MobileLink[]; label?: string }) {
  return (
    <ul aria-label={label} className="grid gap-3">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex min-h-16 items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors active:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-primary-soft text-brand-primary">
              <Icon name={item.icon} className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-zinc-900">{item.label}</span>
              {item.description ? <span className="block text-sm text-zinc-600">{item.description}</span> : null}
            </span>
            <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-zinc-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
