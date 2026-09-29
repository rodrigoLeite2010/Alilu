import type { Metadata } from "next";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { LotteryLoginGate } from "@/components/lotteries/LotteryLoginGate";
import { MeusJogos } from "@/components/lotteries/MeusJogos";
import { LOTTERIES_CATEGORY, lotteryModalities } from "@/data/lotteries";

const modality = lotteryModalities.find((item) => item.id === "lotofacil")!;
const RETURN_PATH = `${modality.path}/meus-jogos`;

// Área privada (jogos e valores da própria pessoa): nunca indexar — mesmo
// padrão de app/financeiro/(privado)/layout.tsx e app/robots.ts.
export const metadata: Metadata = {
  title: "Meus jogos da Lotofácil",
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
            Seu histórico de jogos salvos da Lotofácil: favoritos, conferência manual de resultado, estatística
            pessoal e acompanhamento do quanto você já apostou.
          </p>
          <div className="mt-6">
            <MeusJogos />
          </div>
        </>
      )}
    </Container>
  );
}
