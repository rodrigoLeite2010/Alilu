import Link from "next/link";
import type { ReactNode } from "react";
import { MobileStatusBadge, type MobileStatus } from "@/components/mobile/MobileStatusBadge";

/** Lista vertical de cards: no celular substitui tabelas (sem rolagem horizontal). */
export function MobileCardList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="grid gap-3">
      {children}
    </ul>
  );
}

/**
 * Card de item com título, status, data e uma ação ("Ver", "Abrir"...).
 * O card inteiro é o alvo de toque quando há `href`.
 */
export function MobileStatusCard({
  title,
  status,
  meta,
  href,
  actionLabel = "Ver",
}: {
  title: string;
  status: MobileStatus;
  meta?: string;
  href?: string;
  actionLabel?: string;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-900">{title}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MobileStatusBadge status={status} />
          {meta ? <span className="text-xs text-zinc-600">{meta}</span> : null}
        </span>
      </span>
      {href ? <span className="shrink-0 text-sm font-semibold text-brand-primary">{actionLabel}</span> : null}
    </>
  );

  const base = "flex min-h-16 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm";

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={`${base} transition-colors active:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent`}
        >
          {body}
        </Link>
      ) : (
        <div className={base}>{body}</div>
      )}
    </li>
  );
}
