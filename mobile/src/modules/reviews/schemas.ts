import { z } from 'zod';

/**
 * React Native: ReviewScreen — "avaliar profissional"/"editar avaliação".
 * `rating` já chega como número (o seletor de estrelas chama
 * `setValue('rating', star, ...)` com um inteiro — nunca digitado em texto,
 * então sem `z.coerce` aqui, diferente de `bookingItemQuantitySchema`), mas
 * o schema revalida o intervalo mesmo assim, mesmo limite de
 * `Review.Create`/`Edit` no backend ("Rating entre 1 e 5").
 */
export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, 'Escolha uma nota de 1 a 5.').max(5, 'Escolha uma nota de 1 a 5.'),
  comment: z.string().max(1000, 'Comentário muito longo.').optional(),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
