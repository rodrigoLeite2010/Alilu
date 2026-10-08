export const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 100;
export const DRAW_IMPOSSIBLE_MESSAGE = "Não foi possível realizar o sorteio com as restrições atuais.";

export type GroupStatus = "DRAFT" | "OPEN" | "READY_TO_DRAW" | "DRAWN" | "COMPLETED" | "CANCELLED";
export type RevealMode = "MANUAL" | "AUTOMATIC" | "NEVER";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED";

/** Rótulo do progresso PESSOAL de cada participante (nunca mostra o de outros). */
export type MyProgress = "PARTICIPANDO" | "AMIGO_SORTEADO" | "PRESENTE_ESCOLHIDO" | "PRESENTE_COMPRADO";

export interface GroupSettingsInput {
  name?: string;
  description?: string | null;
  eventDate?: string | null;
  joinDeadline?: string | null;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
  location?: string | null;
  rulesText?: string | null;
  allowAnonymousMessages?: boolean;
  allowWishList?: boolean;
  allowGiftPreferences?: boolean;
  allowParticipantInvites?: boolean;
  allowOwnerSeeDraw?: boolean;
  allowRedraw?: boolean;
  revealMode?: RevealMode;
  revealAt?: string | null;
  avoidPrevious?: boolean;
}
