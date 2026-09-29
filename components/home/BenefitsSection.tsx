import { Container } from "@/components/ui/Container";
import { Icon } from "@/components/ui/Icon";

const BENEFITS = [
  "Gratuito",
  "Funciona pelo navegador",
  "Ferramentas rápidas",
  "Novas funcionalidades constantemente",
  "A maioria das ferramentas pode ser usada sem cadastro",
];

/**
 * "Tudo em um só lugar" — explica o conceito do Alilu em poucas linhas.
 * Evita a afirmação absoluta "sem cadastro" (algumas áreas, como o
 * controle de gastos e a publicação no Instagram, exigem login).
 */
export function BenefitsSection() {
  return (
    <section className="border-b border-zinc-200 bg-zinc-50/70">
      <Container className="py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Tudo em um só lugar</h2>
          <p className="mt-3 text-zinc-600">
            O Alilu reúne ferramentas online simples para resolver tarefas rápidas sem precisar instalar programas.
          </p>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-3">
              <Icon name="shield-check" className="h-4 w-4 shrink-0 text-teal-700" />
              <span className="text-sm font-medium text-zinc-800">{benefit}</span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
