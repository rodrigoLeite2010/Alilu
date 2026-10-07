import { LinkButton } from "@/components/ui/Button";
import { CAROUSEL_PLANS_PATH, isCarouselPlanMessage } from "@/lib/carousel/plan-messages";

/** Botão "Ver planos" logo abaixo de qualquer mensagem de plano/cota do Carrossel Inteligente. */
export function PlansLink({ message, force = false, className = "" }: { message: string | null | undefined; force?: boolean; className?: string }) {
  if (!force && !isCarouselPlanMessage(message)) return null;
  return (
    <LinkButton href={CAROUSEL_PLANS_PATH} className={`mt-3 ${className}`}>
      Ver planos
    </LinkButton>
  );
}
