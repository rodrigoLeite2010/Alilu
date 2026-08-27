import { z } from 'zod';

// `timeSelectionSchema`/`TimeSelectionFormValues` (validação de HH:MM
// digitado à mão) foram removidos junto com a digitação manual de horário
// em TimeSelectionScreen — desde a mudança "só aceitar a hora que o
// profissional deixou livre", o morador escolhe entre as janelas reais
// devolvidas pela Api (`useAvailableTimeWindows`), não digita mais nada
// aqui. Ver `ProfessionalDirectoryController.ListAvailabilityWindows` no
// backend para o histórico completo da decisão.

/** React Native: BookingServicesScreen — quantidade de cada serviço selecionado. */
export const bookingItemQuantitySchema = z.coerce.number().int().min(1, 'Informe ao menos 1.');

/** React Native: BookingConfirmationScreen — "adicionar observações" (opcional, mesmo limite de `Booking.Request` no backend). */
export const bookingNotesSchema = z.string().max(1000, 'Observação muito longa.').optional();
