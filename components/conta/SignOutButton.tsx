"use client";

import { trackLogoutAndReset } from "@/lib/analytics/posthog-client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Botão "Sair da conta" de /minha-conta — mesmo signOut() do UserMenu e do
 * MobileAccountSection (components/layout), sempre com callbackUrl
 * "/?saiu=1" para a home mostrar o aviso de saída (components/layout/LogoutNotice.tsx).
 */
export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={signingOut}
      onClick={() => {
        setSigningOut(true);
        void trackLogoutAndReset().then(() => signOut({ callbackUrl: "/?saiu=1" }));
      }}
      className="w-full justify-center sm:w-auto"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {signingOut ? "Saindo..." : "Sair da conta"}
    </Button>
  );
}
