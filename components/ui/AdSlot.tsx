/**
 * Slot estrutural reservado para publicidade futura (Google AdSense).
 *
 * Nesta fase NENHUM anúncio real é carregado — este componente apenas
 * reserva o espaço visual e evita layout shift quando os anúncios forem
 * habilitados (PROMPT MESTRE, seção 11). Ele nunca deve imitar um botão,
 * um resultado ou a navegação do site.
 */
export function AdSlot({
  label = "Espaço publicitário",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="complementary"
      aria-label={label}
      className={`flex min-h-24 w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-400 ${className}`}
    >
      {label}
    </div>
  );
}
