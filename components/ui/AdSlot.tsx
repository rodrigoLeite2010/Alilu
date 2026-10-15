/**
 * Slot estrutural reservado para publicidade futura (Google AdSense).
 *
 * Sem uma unidade configurada, não há conteúdo visual a renderizar.
 * O loader global é independente deste componente; Auto Ads depende
 * da configuração da conta. Uma futura unidade deve reservar suas dimensões
 * e nunca imitar botão, resultado ou navegação do site.
 */
export function AdSlot() {
  // Sem unidade configurada, não exibir uma caixa vazia de publicidade.
  // O loader e a identificação AdSense existentes permanecem no layout.
  return null;
}
