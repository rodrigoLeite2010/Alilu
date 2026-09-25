/**
 * Textarea que cresce sozinha com o conteúdo (Piloto Automático, Parte 6
 * do briefing de correção: "não cortar visualmente o conteúdo") — sem
 * depender de nenhuma lib externa. Compartilhado entre os campos de texto
 * livre do módulo (contexto da marca, prompt do dia, texto sobre a
 * imagem) para não duplicar a mesma função em cada componente.
 */
export function autoResizeTextarea(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
