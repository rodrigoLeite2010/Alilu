/**
 * Lógica de cálculo do Divisor de Conta/Despesas, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side —
 * nenhum nome ou valor informado é enviado ou armazenado (PROMPT MESTRE,
 * seção "Divisor de conta": "Não armazenar nomes/valores").
 *
 * Dois modos:
 *  - divisão IGUAL entre N pessoas (taxa de serviço e desconto aplicados
 *    sobre o total antes de dividir);
 *  - divisão PERSONALIZADA por participante (cada um informa quanto
 *    consumiu; a taxa de serviço e o desconto são rateados proporcionalmente
 *    ao consumo de cada um, e não dividido em partes iguais).
 */

export interface BillSplitParticipant {
  name: string;
  amount: number;
}

export interface BillSplitInput {
  mode: "equal" | "custom";
  /** Valor total da conta (R$). Em modo "custom", é derivado da soma dos participantes se não informado. */
  total: number;
  /** Número de pessoas, usado apenas no modo "equal". */
  peopleCount: number;
  /** Taxa de serviço (%), ex.: os 10% do garçom. */
  serviceFeePercent: number;
  /** Desconto (%) sobre o total, ex.: cupom ou promoção. */
  discountPercent: number;
  /** Participantes e o quanto cada um consumiu, usado apenas no modo "custom". */
  participants: BillSplitParticipant[];
}

export interface BillSplitFieldErrors {
  total?: string;
  peopleCount?: string;
  serviceFeePercent?: string;
  discountPercent?: string;
  participants?: string;
}

export interface BillSplitParticipantResult extends BillSplitParticipant {
  /** Valor final a pagar por este participante, já com taxa/desconto rateados. */
  amountToPay: number;
}

export interface BillSplitResult {
  /** Total final da conta, já com taxa de serviço e desconto aplicados — resultado principal. */
  headline: number;
  subtotal: number;
  serviceFeeAmount: number;
  discountAmount: number;
  /** Valor por pessoa no modo "equal" (undefined no modo "custom"). */
  amountPerPerson?: number;
  /** Detalhamento por participante no modo "custom" (undefined no modo "equal"). */
  participants?: BillSplitParticipantResult[];
}

export function validateBillSplitInput(input: BillSplitInput): BillSplitFieldErrors {
  const errors: BillSplitFieldErrors = {};

  if (!Number.isFinite(input.serviceFeePercent) || input.serviceFeePercent < 0) {
    errors.serviceFeePercent = "A taxa de serviço não pode ser negativa.";
  }
  if (
    !Number.isFinite(input.discountPercent) ||
    input.discountPercent < 0 ||
    input.discountPercent > 100
  ) {
    errors.discountPercent = "O desconto deve ser um percentual entre 0 e 100.";
  }

  if (input.mode === "equal") {
    if (!Number.isFinite(input.total) || input.total <= 0) {
      errors.total = "Informe um valor total maior que zero.";
    }
    if (
      !Number.isFinite(input.peopleCount) ||
      !Number.isInteger(input.peopleCount) ||
      input.peopleCount <= 0
    ) {
      errors.peopleCount = "Informe um número de pessoas válido (maior que zero).";
    }
  } else {
    const validParticipants = input.participants.filter(
      (participant) => participant.name.trim() !== ""
    );
    if (validParticipants.length === 0) {
      errors.participants = "Adicione pelo menos um participante.";
    } else if (
      validParticipants.some(
        (participant) => !Number.isFinite(participant.amount) || participant.amount < 0
      )
    ) {
      errors.participants = "O valor de cada participante não pode ser negativo.";
    } else if (validParticipants.every((participant) => participant.amount === 0)) {
      errors.participants = "Informe quanto pelo menos um participante consumiu.";
    }
  }

  return errors;
}

export function isBillSplitInputValid(input: BillSplitInput): boolean {
  return Object.keys(validateBillSplitInput(input)).length === 0;
}

/**
 * Calcula a divisão da conta. Assume que `input` já foi validado (ver
 * validateBillSplitInput).
 */
export function calculateBillSplit(input: BillSplitInput): BillSplitResult {
  if (input.mode === "equal") {
    const subtotal = input.total;
    const serviceFeeAmount = subtotal * (input.serviceFeePercent / 100);
    const discountAmount = subtotal * (input.discountPercent / 100);
    const finalTotal = subtotal + serviceFeeAmount - discountAmount;
    const amountPerPerson = finalTotal / input.peopleCount;

    return {
      headline: finalTotal,
      subtotal,
      serviceFeeAmount,
      discountAmount,
      amountPerPerson,
    };
  }

  const validParticipants = input.participants.filter(
    (participant) => participant.name.trim() !== ""
  );
  const subtotal = validParticipants.reduce(
    (sum, participant) => sum + participant.amount,
    0
  );
  const serviceFeeAmount = subtotal * (input.serviceFeePercent / 100);
  const discountAmount = subtotal * (input.discountPercent / 100);
  const finalTotal = subtotal + serviceFeeAmount - discountAmount;

  // Fator de ajuste (taxa - desconto) aplicado proporcionalmente ao consumo
  // de cada participante, para que a soma dos valores finais feche
  // exatamente com finalTotal.
  const adjustmentFactor = subtotal > 0 ? finalTotal / subtotal : 0;

  const participants: BillSplitParticipantResult[] = validParticipants.map(
    (participant) => ({
      ...participant,
      amountToPay: participant.amount * adjustmentFactor,
    })
  );

  return {
    headline: finalTotal,
    subtotal,
    serviceFeeAmount,
    discountAmount,
    participants,
  };
}
