import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { MobileLink } from "@/components/mobile/mobile-links";

/** Grade 2x2 de ações principais: ícone, nome e descrição curta, alvo de toque grande. */
export function MobileActionGrid({ items }: { items: MobileLink[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex h-full min-h-28 flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors active:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary-soft text-brand-primary">
              <Icon name={item.icon} className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-semibold leading-tight text-zinc-900">{item.label}</span>
              {item.description ? <span className="mt-1 block text-xs text-zinc-600">{item.description}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
