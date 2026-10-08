import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { InviteAccept } from "@/components/secret-santa/InviteAccept";
import { budgetLabel, formatDateBr } from "@/components/secret-santa/api";
import { getInvitePreview, inviteMessage, type InviteProblem } from "@/lib/secret-santa/backend/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Convite de Amigo Secreto | Alilu", robots: { index: false, follow: false, nocache: true } };

/** Convite por link com token imprevisível. Quem não está logado entra/cadastra e volta aqui. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = (await auth())?.user?.id ?? null;
  const preview = await getInvitePreview(token, userId);

  const group = "group" in preview ? preview.group : undefined;
  if (!group || !("alreadyMember" in preview)) {
    return (
      <Container className="max-w-lg py-14">
        <section className="rounded-lg border border-zinc-200 p-6 text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Convite inválido ou expirado</h1>
          <p className="mt-2 text-sm text-zinc-600">{inviteMessage("INVALID")} Peça um novo link ao organizador.</p>
          <Link href="/amigo-secreto" className="mt-4 inline-block text-sm font-semibold text-rose-800 underline">
            Ir para o Amigo Secreto
          </Link>
        </section>
      </Container>
    );
  }

  const budget = budgetLabel(group.budgetMinCents, group.budgetMaxCents);
  const problem = (preview.problem ?? null) as InviteProblem | null;
  const callback = `/amigo-secreto/convite/${token}`;

  return (
    <Container className="max-w-lg py-10">
      <section className="space-y-4 rounded-lg border border-rose-200 bg-rose-50/40 p-6">
        <p className="text-sm font-medium text-rose-800">🎁 Você foi convidado para o Amigo Secreto</p>
        <h1 className="text-2xl font-bold text-zinc-900">{group.name}</h1>
        <dl className="grid gap-2 text-sm">
          {group.ownerName ? (
            <div>
              <dt className="text-xs text-zinc-500">Organizador</dt>
              <dd>{group.ownerName}</dd>
            </div>
          ) : null}
          {group.eventDate ? (
            <div>
              <dt className="text-xs text-zinc-500">Data</dt>
              <dd>{formatDateBr(group.eventDate)}</dd>
            </div>
          ) : null}
          {group.location ? (
            <div>
              <dt className="text-xs text-zinc-500">Local</dt>
              <dd>{group.location}</dd>
            </div>
          ) : null}
          {budget ? (
            <div>
              <dt className="text-xs text-zinc-500">Valor do presente</dt>
              <dd>{budget}</dd>
            </div>
          ) : null}
          {group.rulesText ? (
            <div>
              <dt className="text-xs text-zinc-500">Regras</dt>
              <dd className="whitespace-pre-wrap">{group.rulesText}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-zinc-500">Já confirmados</dt>
            <dd>{group.participantCount}</dd>
          </div>
        </dl>

        {preview.alreadyMember && preview.groupId ? (
          <Link href={`/amigo-secreto/${preview.groupId}`} className="flex min-h-11 items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white">
            Você já participa — abrir o grupo
          </Link>
        ) : problem ? (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {inviteMessage(problem)}
          </p>
        ) : userId ? (
          <InviteAccept token={token} canDecline={Boolean(preview.invitedName)} />
        ) : (
          <div className="space-y-2">
            <Link
              href={`/entrar?callbackUrl=${encodeURIComponent(callback)}`}
              className="flex min-h-11 items-center justify-center rounded-md bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white"
            >
              Entrar para participar
            </Link>
            <p className="text-center text-xs text-zinc-500">Você pode entrar com o seu e-mail ou criar a conta na hora. Depois volta direto para este convite.</p>
          </div>
        )}
      </section>
    </Container>
  );
}
