import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AgendaApp } from "@/components/agenda/AgendaApp";
import { getPreferences } from "@/lib/agenda/backend/agenda-repository";
import { getUserPreferences } from "@/lib/agenda/backend/agenda-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda | Alilu", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ evento?: string; novo?: string }>;
}

/** Agenda pessoal: compromissos com lembrete por e-mail. Cada usuário vê só a própria agenda. */
export default async function AgendaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const eventId = typeof params.evento === "string" && /^[0-9a-f-]{36}$/i.test(params.evento) ? params.evento : null;

  if (!userId) {
    const returnPath = eventId ? `/agenda?evento=${eventId}` : params.novo ? "/agenda?novo=1" : "/agenda";
    return (
      <Container className="max-w-lg py-14">
        <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-6 text-center sm:p-8">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-800">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="mt-3 text-xl font-semibold text-zinc-900">Entre para usar sua agenda</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Anote compromissos, aniversários e contas a pagar, e receba lembretes por e-mail. Sua agenda é privada: só você vê.
          </p>
          <Link
            href={`/entrar?callbackUrl=${encodeURIComponent(returnPath)}`}
            className="mt-5 inline-flex rounded-md bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Entrar
          </Link>
        </section>
      </Container>
    );
  }

  const [preferences, saved] = await Promise.all([getUserPreferences(userId), getPreferences(userId)]);
  return (
    <Container className="max-w-5xl py-8 sm:py-12">
      <AgendaApp
        initialPreferences={preferences}
        hasSavedPreferences={saved !== null}
        initialEventId={eventId}
        openNew={params.novo === "1"}
        userFirstName={session.user?.name?.split(" ")[0] ?? null}
      />
    </Container>
  );
}
