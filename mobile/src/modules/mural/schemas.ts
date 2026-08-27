import { z } from 'zod';

/** React Native: tela "Novo post" do Mural — `type` é validado pelo próprio seletor (sempre um dos quatro valores), então o schema só garante o texto. */
export const muralPostFormSchema = z.object({
  content: z.string().min(1, 'Escreva o que você quer publicar.').max(1000, 'Texto muito longo.'),
});

export type MuralPostFormValues = z.infer<typeof muralPostFormSchema>;
