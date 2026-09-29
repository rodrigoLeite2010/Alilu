import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { getFeaturedTools } from "@/data/tools";

/**
 * "Ferramentas populares": lê getFeaturedTools() (data/tools.ts), que já
 * filtra por featureRank — não há lista nova para manter, só ampliamos os
 * destaques editoriais existentes (ver __tests__/data/catalog.test.ts).
 * Some sozinha se, por algum motivo, o catálogo ficar sem destaques.
 */
export function FeaturedTools() {
  const featuredTools = getFeaturedTools();

  if (featuredTools.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-zinc-200 bg-zinc-50/70">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          title="Ferramentas populares"
          description="Um atalho para algumas das ferramentas mais usadas do catálogo."
        />
        <ToolGrid tools={featuredTools} />
      </Container>
    </section>
  );
}
