import { z } from 'zod';

import { DATE_PATTERN, TIME_PATTERN } from './availabilityFormat';

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

/** React Native: AvailabilityEditor — "configurar dias; configurar horários". "Não permitir StartTime >= EndTime" (PROMPT 07) validado aqui, antes mesmo de chegar na Api. */
export const availabilitySlotSchema = z
  .object({
    dayOfWeek: z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    startTime: z.string().regex(TIME_PATTERN, 'Use o formato HH:MM.'),
    endTime: z.string().regex(TIME_PATTERN, 'Use o formato HH:MM.'),
  })
  .refine((values) => values.startTime < values.endTime, {
    message: 'O horário de início precisa ser antes do término.',
    path: ['endTime'],
  });

export type AvailabilitySlotFormValues = z.infer<typeof availabilitySlotSchema>;

/**
 * React Native: BlockedDatesScreen — "bloquear datas; liberar horários
 * específicos". `isFullDay` decide entre bloquear/liberar o dia inteiro
 * (a tela não pede horário nesse caso) ou só uma janela específica dentro
 * do dia.
 */
export const availabilityExceptionSchema = z
  .object({
    date: z.string().regex(DATE_PATTERN, 'Use o formato AAAA-MM-DD.'),
    type: z.enum(['Blocked', 'Available']),
    isFullDay: z.boolean(),
    startTime: z.union([z.string().regex(TIME_PATTERN, 'Use o formato HH:MM.'), z.literal('')]).optional(),
    endTime: z.union([z.string().regex(TIME_PATTERN, 'Use o formato HH:MM.'), z.literal('')]).optional(),
    reason: z.string().max(500, 'Motivo muito longo.').optional(),
  })
  .refine((values) => values.isFullDay || (values.startTime && values.endTime), {
    message: 'Informe início e término, ou marque "dia inteiro".',
    path: ['startTime'],
  })
  .refine((values) => values.isFullDay || !values.startTime || !values.endTime || values.startTime < values.endTime, {
    message: 'O horário de início precisa ser antes do término.',
    path: ['endTime'],
  });

export type AvailabilityExceptionFormValues = z.infer<typeof availabilityExceptionSchema>;
