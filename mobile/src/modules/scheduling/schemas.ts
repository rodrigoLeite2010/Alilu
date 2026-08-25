import { z } from 'zod';

import { TIME_PATTERN } from './schedulingFormat';

/**
 * React Native: TimeSelectionScreen — "escolher horário". A janela em si
 * (se está disponível/livre de conflito) só é validada pelo servidor
 * ("nunca confiar no calendário do React Native", REGRA CRÍTICA) — este
 * schema só garante um formato/ordem coerentes antes de chamar a consulta
 * de disponibilidade.
 */
export const timeSelectionSchema = z
  .object({
    startTime: z.string().regex(TIME_PATTERN, 'Use o formato HH:MM.'),
    endTime: z.string().regex(TIME_PATTERN, 'Use o formato HH:MM.'),
  })
  .refine((values) => values.startTime < values.endTime, {
    message: 'O horário de início precisa ser antes do término.',
    path: ['endTime'],
  });

export type TimeSelectionFormValues = z.infer<typeof timeSelectionSchema>;

/** React Native: BookingServicesScreen — quantidade de cada serviço selecionado. */
export const bookingItemQuantitySchema = z.coerce.number().int().min(1, 'Informe ao menos 1.');

/** React Native: BookingConfirmationScreen — "adicionar observações" (opcional, mesmo limite de `Booking.Request` no backend). */
export const bookingNotesSchema = z.string().max(1000, 'Observação muito longa.').optional();
