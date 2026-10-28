import { FinancingTool } from "@/components/tools/financing/FinancingTool";
export const metadata = {
  title: "Simular financiamento imobiliário",
  robots: { index: false, follow: true },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ valor?: string }>;
}) {
  const value = Number((await searchParams).valor);
  const price =
    Number.isFinite(value) && value > 0 && value <= 1e12 ? value : 0;
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Simular financiamento imobiliário</h1>
      <p className="my-5 text-zinc-600">
        Ajuste a entrada, o prazo e a taxa para comparar SAC e Price. Esta
        simulação é uma estimativa e não é uma proposta ou aprovação de banco.
        Seguros, tarifas, correção monetária e tributos não estão incluídos.
      </p>
      <div className="estate-panel">
        <FinancingTool initialAssetValue={price} />
      </div>
    </section>
  );
}
