import { z } from 'zod';

/** React Native: tela "Convidar prestador" — `email` é opcional, mesma nullability de `ProfessionalInvitation.Email` no backend. */
export const professionalInvitationFormSchema = z.object({
  name: z.string().min(1, 'Informe o nome do prestador.').max(200, 'Nome muito longo.'),
  phone: z.string().min(1, 'Informe o telefone do prestador.').max(30, 'Telefone muito longo.'),
  email: z.union([z.literal(''), z.string().email('E-mail inválido.').max(200, 'E-mail muito longo.')]).optional(),
});

export type ProfessionalInvitationFormValues = z.infer<typeof professionalInvitationFormSchema>;
