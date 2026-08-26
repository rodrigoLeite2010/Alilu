/**
 * Espelha `Alilu.Modules.Reviews.Application/Dtos.cs` (PROMPT 09). A Api
 * serializa em camelCase — mesma observação já registrada em
 * `modules/scheduling/types.ts` (Etapa 08).
 *
 * Campos exatamente como o backend devolve — de propósito NÃO há
 * `updatedAt` (diferente de `Booking`, que tem os dois campos) — ver
 * `Review.cs` no backend.
 */
export interface Review {
  id: string;
  bookingId: string;
  residentId: string;
  professionalId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** React Native: RatingSummary/ProfessionalReviewsScreen — "visualizar média". `totalReviews` zero implica `averageRating` zero. */
export interface ProfessionalRatingSummary {
  professionalId: string;
  totalReviews: number;
  averageRating: number;
}

/** Corpo de `POST /api/resident/reviews` (React Native: ReviewScreen — "avaliar profissional"). */
export interface CreateReviewPayload {
  bookingId: string;
  rating: number;
  comment?: string;
}

/** Corpo de `PUT /api/resident/reviews/{id}` (React Native: ReviewScreen — "editar avaliação"). */
export interface EditReviewPayload {
  rating: number;
  comment?: string;
}
