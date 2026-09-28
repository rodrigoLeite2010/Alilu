/**
 * Configuração centralizada da funcionalidade de apoio/doação via Pix.
 * Único lugar do projeto onde as variáveis de ambiente da doação são lidas
 * — nunca ler NEXT_PUBLIC_PIX_KEY (ou as demais) diretamente em outro
 * arquivo, para não espalhar a chave Pix pelo código.
 *
 * Mesmo padrão de lib/seo/site.ts: variáveis NEXT_PUBLIC_* são substituídas
 * em tempo de build pelo Next.js, então funcionam igual em componentes de
 * servidor e de cliente.
 */

export interface DonationConfig {
  /** true só quando a doação está habilitada E todos os dados essenciais do payload Pix estão presentes. */
  enabled: boolean;
  pixKey: string;
  receiverName: string;
  receiverCity: string;
}

/**
 * "false"/"0" desliga explicitamente. Qualquer outro valor (incluindo a
 * variável ausente) mantém a doação habilitada por padrão — a chave Pix
 * ausente/vazia já desliga tudo sozinha (ver `enabled` abaixo), então não
 * há risco de mostrar uma área de doação quebrada mesmo com o padrão em
 * "ligado".
 */
function readEnabledFlag(raw: string | undefined): boolean {
  const normalized = raw?.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0";
}

export function getDonationConfig(): DonationConfig {
  const pixKey = process.env.NEXT_PUBLIC_PIX_KEY?.trim() ?? "";
  const receiverName = process.env.NEXT_PUBLIC_PIX_RECEIVER_NAME?.trim() ?? "";
  const receiverCity = process.env.NEXT_PUBLIC_PIX_RECEIVER_CITY?.trim() ?? "";
  const flagEnabled = readEnabledFlag(process.env.NEXT_PUBLIC_DONATION_ENABLED);

  const hasEssentialData = pixKey.length > 0 && receiverName.length > 0 && receiverCity.length > 0;

  return {
    enabled: flagEnabled && hasEssentialData,
    pixKey,
    receiverName,
    receiverCity,
  };
}
