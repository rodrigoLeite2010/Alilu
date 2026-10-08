"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { call } from "./api";

export function InviteAccept({ token, canDecline }: { token: string; canDecline: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const result = await call<{ groupId: string }>("POST", `/api/secret-santa/invitations/${encodeURIComponent(token)}/accept`);
    if (result.error || !result.data) {
      setBusy(false);
      setError(result.error ?? "Não foi possível entrar agora.");
      return;
    }
    router.push(`/amigo-secreto/${result.data.groupId}`);
  }
  async function decline() {
    setBusy(true);
    const result = await call("POST", `/api/secret-santa/invitations/${encodeURIComponent(token)}/decline`);
    setBusy(false);
    if (result.error) setError(result.error);
    else router.push("/amigo-secreto");
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={accept} disabled={busy} className="w-full">
        {busy ? "Entrando…" : "Participar"}
      </Button>
      {canDecline ? (
        <Button type="button" variant="ghost" onClick={decline} disabled={busy} className="w-full">
          Não vou participar
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p className="text-center text-xs text-zinc-500">
        <Link href="/amigo-secreto" className="underline">
          Ver meus grupos
        </Link>
      </p>
    </div>
  );
}
