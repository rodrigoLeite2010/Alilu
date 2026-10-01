import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWalletWithWelcomeBonus } from "@/lib/ai-video/backend/generation-service";
import { listTransactions } from "@/lib/ai-video/backend/wallet-repository";
import { listPurchasesForUser } from "@/lib/ai-video/backend/credit-purchase-repository";
import { getActivePricingConfig } from "@/lib/ai-video/backend/pricing-repository";
import { serializePurchase, serializeTransaction, serializeWallet } from "@/lib/ai-video/backend/ai-video-dto";

export const dynamic = "force-dynamic";

/** GET: saldo (concede o bônus de boas-vindas na 1ª vez), extrato e compras. */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const [wallet, transactions, purchases, config] = await Promise.all([
    getWalletWithWelcomeBonus(userId),
    listTransactions(userId, 30),
    listPurchasesForUser(userId),
    getActivePricingConfig(),
  ]);
  return NextResponse.json({
    wallet: serializeWallet(wallet),
    transactions: transactions.map(serializeTransaction),
    purchases: purchases.map((purchase) => serializePurchase(purchase, config.purchaseRefundWindowDays)),
  });
}
