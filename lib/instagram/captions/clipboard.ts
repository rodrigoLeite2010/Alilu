/**
 * Copiar para a área de transferência (ETAPA 11), com fallback para
 * navegadores/contextos sem `navigator.clipboard` (ex.: páginas abertas
 * fora de HTTPS ou navegadores mais antigos) — usa um `<textarea>`
 * temporário e `document.execCommand("copy")`, exatamente como pedido na
 * especificação.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Segue para o fallback abaixo em vez de desistir.
    }
  }
  return copyWithExecCommandFallback(text);
}

function copyWithExecCommandFallback(text: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let succeeded = false;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  }

  document.body.removeChild(textarea);
  return succeeded;
}
