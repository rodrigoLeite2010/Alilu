import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { listManagedInstagramAccounts } from "@/lib/instagram/backend/facebook-login";
import { getFacebookOAuthAttempt } from "@/lib/instagram/backend/facebook-oauth-pending";
import { getInstagramAccountByIdForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { FacebookInstagramAccountPicker } from "@/components/instagram/FacebookInstagramAccountPicker";

export const dynamic = "force-dynamic";

export default async function FacebookInstagramAccountsPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar?callbackUrl=%2Finstagram%2Fpainel");
  const { attempt: attemptId } = await searchParams;
  if (!attemptId) redirect("/instagram/painel?status=erro");
  const attempt = await getFacebookOAuthAttempt(attemptId, session.user.id);
  if (!attempt?.facebookUserTokenEncrypted) redirect("/instagram/painel?status=erro&mensagem=tentativa-oauth-expirada");
  const accounts = await listManagedInstagramAccounts(decryptSecret(attempt.facebookUserTokenEncrypted));
  const target = attempt.targetAccountId ? await getInstagramAccountByIdForUser(attempt.targetAccountId, session.user.id) : null;
  return <main className="mx-auto max-w-xl px-4 py-12">
    <h1 className="text-xl font-semibold">Selecione a conta profissional do Instagram</h1>
    <p className="mt-2 text-sm text-zinc-600">As contas abaixo foram fornecidas pela Meta para as Páginas que você administra. A conexão só será salva depois que você escolher uma.</p>
    {target ? <p className="mt-3 rounded bg-amber-50 p-3 text-sm">Reconexão solicitada: <strong>@{target.igUsername ?? target.igUserId}</strong>. Se escolher outra conta, ela será adicionada separadamente e a reconexão ficará intacta.</p> : null}
    <FacebookInstagramAccountPicker attemptId={attempt.id} targetIgUserId={attempt.expectedIgUserId} accounts={accounts.map(({ pageId, pageName, igUserId, username }) => ({ pageId, pageName, igUserId, username }))} />
  </main>;
}
