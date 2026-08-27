/**
 * Espelha `Alilu.Modules.Professional.Application/Dtos.cs#ProfessionalInvitationResponse`
 * (Etapa 23, pedido 1 de Rodrigo: "convidar um prestador — a pessoa
 * recebe msg whatsapp e email"). A Api serializa em camelCase.
 */
export interface ProfessionalInvitation {
  id: string;
  condominiumId: string;
  invitedByUserId: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
  whatsAppDelivered: boolean;
  smsDelivered: boolean;
  /** `null` quando nenhum e-mail foi informado (não confundir com "informado, mas falhou" = `false`). */
  emailDelivered: boolean | null;
}

/** Corpo de `POST /api/resident/professional-invitations` (React Native: tela "Convidar prestador"). */
export interface CreateProfessionalInvitationPayload {
  name: string;
  phone: string;
  email?: string;
}
