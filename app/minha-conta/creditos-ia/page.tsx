import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { AiCreditsManager } from "@/components/ai-video/AiCreditsManager";
import { getWalletWithWelcomeBonus, listGenerationOptions } from "@/lib/ai-video/backend/generation-service";
import { listTransactions } from "@/lib/ai-video/backend/wallet-repository";
import { listPurchasesForUser } from "@/lib/ai-video/backend/credit-purchase-repository";
import { getActivePricingConfig, listPackages } from "@/lib/ai-video/backend/pricing-repository";
import { hasBillingCustomer } from "@/lib/ai-video/backend/credit-purchase-service";
import { serializePurchase, serializeTransaction } from "@/lib/ai-video/backend/ai-video-dto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Créditos de IA | Alilu",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ voltar?: string; custo?: string }>;
}

/** Só caminhos internos — nunca redireciona para fora do site. */
function safeReturnPath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** Minha conta > Créditos de IA. */
export default async function AiCreditsPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <Container className="py-10 sm:py-14">
        <AccountLoginGate returnPath="/minha-conta/creditos-ia" />
      </Container>
    );
  }
  const params = await searchParams;
  const returnTo = safeReturnPath(params.voltar);
  const required = Number(params.custo);

  const [wallet, packages, purchases, transactions, config, options, customer] = await Promise.all([
    getWalletWithWelcomeBonus(userId),
    listPackages(true),
    listPurchasesForUser(userId),
    listTransactions(userId, 30),
    getActivePricingConfig(),
    listGenerationOptions(),
    hasBillingCustomer(userId),
  ]);
  const shortVideo = options.find((option) => option.tier === "ECONOMICO" && option.durationSeconds === 5) ?? options[0] ?? null;

  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/minha-conta" className="hover:underline">
          Minha conta
        </Link>{" "}
        › Créditos de IA
      </nav>
      <h1 className="text-2xl font-semibold text-zinc-900">Créditos de IA</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Use créditos para gerar vídeos a partir de imagens em{" "}
        <Link href="/videos/imagem-para-video" className="font-medium text-teal-800 hover:underline">
          Vídeos › Imagem para vídeo com IA
        </Link>
        .
      </p>
      <div className="mt-6">
        <AiCreditsManager
          initialAvailable={wallet.available}
          initialReserved={wallet.reserved}
          packages={packages.map((pkg) => ({
            code: pkg.code,
            name: pkg.name,
            credits: pkg.credits,
            bonusCredits: pkg.bonusCredits,
            priceCents: pkg.priceCents,
          }))}
          initialPurchases={purchases.map((purchase) => serializePurchase(purchase, config.purchaseRefundWindowDays))}
          initialTransactions={transactions.map(serializeTransaction)}
          creditsPerShortVideo={shortVideo?.credits ?? null}
          hasBillingCustomer={customer}
          returnTo={returnTo}
          requiredCredits={Number.isFinite(required) && required > 0 ? Math.round(required) : null}
          refundWindowDays={config.purchaseRefundWindowDays}
        />
      </div>
    </Container>
  );
}
