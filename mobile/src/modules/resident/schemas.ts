import { z } from 'zod';

export const invitationCodeSchema = z.object({
  code: z
    .string()
    .min(1, 'Informe o código do convite.')
    .max(20, 'Código inválido.'),
});

export type InvitationCodeFormValues = z.infer<typeof invitationCodeSchema>;
