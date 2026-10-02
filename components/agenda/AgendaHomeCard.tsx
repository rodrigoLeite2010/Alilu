"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { whenLabel } from "@/lib/agenda/time";
import type { AgendaEventDto } from "@/lib/agenda/types";

interface NextResponse {
  loggedIn: boolean;
  next?: { event: AgendaEventDto; startAt: string } | null;
  timezone?: string;
}

/** Card "Seu próximo compromisso" na home — só para quem está logado. */
export function AgendaHomeCard() {
  const [data, setData] = useState<NextResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agenda/next", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<NextResponse>) : null))
      .then((body) => {
        if (!cancelled && body) setData(body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.loggedIn) return null;
  const next = data.next;
  return (
    <Container className="pt-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agenda · Seu próximo compromisso</p>
          {next ? (
            <>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{next.event.title}</p>
              <p className="text-sm text-zinc-600">{whenLabel(new Date(next.startAt), next.event.isAllDay, data.timezone ?? next.event.timezone)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">Nenhum compromisso nos próximos dias.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/agenda" className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Abrir agenda
          </Link>
          {!next ? (
            <Link href="/agenda?novo=1" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
              + Novo
            </Link>
          ) : null}
        </div>
      </section>
    </Container>
  );
}
