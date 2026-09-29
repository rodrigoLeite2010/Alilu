import type { Metadata } from "next";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { LotteryLoginGate } from "@/components/lotteries/LotteryLoginGate";
import { MeusJogos } from "@/components/lotteries/MeusJogos";
import { LOTTERIES_CATEGORY, lotteryModalities } from "@/data/lotteries";
import { DIA_DE_SORTE_CONFIG } from "@/lib/lotteries/dia-de-sorte-config";

const modality = lotteryModalities.find((item) => item.id === "dia-de-sorte")!;
const RETURN_PATH = `${modality.path}/meus-jogos`;

// Área privada (jogos e valores da própria pessoa): nunca indexar — mesmo
// padrão de app/financeiro/(privado)/layout.tsx, app/robots.ts e dos
// equivalentes da Lotofácil, da Mega-Sena, da Quina e da Lotomania
// (app/loterias/lotofacil/meus-jogos/page.tsx,
// app/loterias/mega-sena/meus-jogos/page.tsx,
// app/loterias/quina/meus-jogos/page.tsx,
// app/loterias/lotomania/meus-jogos/page.tsx).
export const metadata: Metadata = {
  title: "Meus jogos do Dia de Sorte",
  robots: { index: false, follow: false },
};

export default async function MeusJogosPage() {
  const session = await auth();

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: LOTTERIES_CATEGORY.shortName, path: LOTTERIES_CATEGORY.path },
          { name: modality.shortName, path: modality.path },
          { name: "Meus jogos", path: RETURN_PATH },
        ]}
      />

      {!session?.user?.id ? (
        <div className="mt-6">
          <LotteryLoginGate returnPath={RETURN_PATH} />
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Meus jogos</h1>
          <p className="mt-2 max-w-2xl text-base text-zinc-600">
            Seu histórico de jogos salvos do Dia de Sorte (números e Mês da Sorte): favoritos, conferência manual de
            resultado, estatística pessoal e acompanhamento do quanto você já apostou.
          </p>
          <div className="mt-6">
            <MeusJogos
              modality="dia-de-sorte"
              minNumber={DIA_DE_SORTE_CONFIG.minNumber}
              maxNumber={DIA_DE_SORTE_CONFIG.maxNumber}
              drawnNumbers={DIA_DE_SORTE_CONFIG.drawnNumbers}
              reusePath="/loterias/dia-de-sorte"
              hasMonthPick
            />
          </div>
        </>
      )}
    </Container>
  );
}
