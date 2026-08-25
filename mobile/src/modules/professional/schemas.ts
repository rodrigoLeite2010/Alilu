import { z } from 'zod';

/** React Native: ProfessionalEditScreen — criação/edição de perfil. */
export const professionalProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Informe seu nome de exibição.')
    .max(120, 'Nome muito longo.'),
  description: z.string().max(1000, 'Descrição muito longa.').optional(),
  phone: z.string().max(20, 'Telefone inválido.').optional(),
});

export type ProfessionalProfileFormValues = z.infer<typeof professionalProfileSchema>;
