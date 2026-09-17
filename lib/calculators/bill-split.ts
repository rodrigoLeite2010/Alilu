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

/**
 * Limite máximo de pessoas no modo "equal". Sem um teto, `peopleCount`
 * chega inteiro do formulário até o cálculo — um valor absurdo (ex.:
 * 1.000.000.000) não deve conseguir travar a aplicação. 500 cobre
 * qualquer uso realista da ferramenta (divisão de conta/despesas entre um
 * grupo de pessoas) com folga.
 */
export const BILL_SPLIT_MAX_PEOPLE = 500;

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

/** Um grupo de pessoas que paga o mesmo valor arredondado, no modo "equal". */
export interface BillSplitEqualShare {
  amount: number;
  peopleCount: number;
}

export interface BillSplitResult {
  /** Total final da conta, já com taxa de serviço e desconto aplicados — resultado principal. */
  headline: number;
  subtotal: number;
  serviceFeeAmount: number;
  discountAmount: number;
  /**
   * Valor por pessoa no modo "equal" (undefined no modo "custom"). Só é
   * definido quando a divisão fecha em um valor exatamente igual para
   * todos, em centavos — ver `equalShares` para o caso contrário.
   */
  amountPerPerson?: number;
  /**
   * Modo "equal": quebra em centavos garantindo que a soma dos valores
   * pagos por todos feche exatamente com `headline`, mesmo quando o total
   * não é divisível igualmente entre as pessoas (ex.: R$100 entre 3
   * pessoas). Sempre presente no modo "equal"; tem 1 grupo quando a divisão
   * é exata, 2 grupos quando sobra resto de centavos.
   */
  equalShares?: BillSplitEqualShare[];
  /** Detalhamento por participante no modo "custom" (undefined no modo "equal"). */
  participants?: BillSplitParticipantResult[];
}

/**
 * Distribui `totalCents` centavos entre os valores aproximados em `amounts`
 * (em reais), arredondando cada um para baixo e depois distribuindo os
 * centavos restantes (método dos maiores restos) para quem tem a maior
 * parte fracionária — garante que a soma final bate exatamente com
 * `totalCents`, sem perder nem duplicar centavo (essencial em ferramenta
 * financeira que divide dinheiro real entre pessoas).
 *
 * Usada apenas no modo "custom" (rateio personalizado), onde `amounts` tem
 * um item por participante realmente adicionado na tela — uma lista que só
 * cresce por clique do usuário em "Adicionar participante", nunca por um
 * campo numérico livre. O modo "equal" NÃO usa mais esta função: ele
 * calcula a quebra em centavos com aritmética pura (ver
 * `calculateBillSplit`), sem materializar nenhum array do tamanho de
 * `peopleCount`, para não permitir alocações proporcionais a um número que
 * o usuário digita livremente (ver `BILL_SPLIT_MAX_PEOPLE`).
 */
function distributeCentsExact(amounts: number[], totalCents: number): number[] {
  const rawCents = amounts.map((amount) => amount * 100);
  const floors = rawCents.map((cents) => Math.floor(cents));
  const flooredTotal = floors.reduce((sum, cents) => sum + cents, 0);
  let remainder = totalCents - flooredTotal;

  const byFractionDesc = rawCents
    .map((cents, index) => ({ index, fraction: cents - Math.floor(cents) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  for (let i = 0; i < byFractionDesc.length && remainder > 0; i++) {
    result[byFractionDesc[i].index] += 1;
    remainder -= 1;
  }
  // Defensivo: em tese `remainder` nunca fica negativo aqui, mas se algum
  // valor de entrada não-finito escapar da validação, isso evita que a soma
  // final se afaste do total em vez de lançar um valor incoerente.
  for (let i = byFractionDesc.length - 1; i >= 0 && remainder < 0; i--) {
    result[byFractionDesc[i].index] -= 1;
    remainder += 1;
  }

  return result.map((cents) => cents / 100);
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
    } else if (input.peopleCount > BILL_SPLIT_MAX_PEOPLE) {
      errors.peopleCount = `O número de pessoas não pode ser maior que ${BILL_SPLIT_MAX_PEOPLE}.`;
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

    // Defesa em profundidade: calculateBillSplit assume que o input já foi
    // validado (validateBillSplitInput, que já rejeita peopleCount fora de
    // [1, BILL_SPLIT_MAX_PEOPLE]), mas nunca deixamos um valor inválido ou
    // excessivo (não-finito, decimal, negativo, zero, ou um valor absurdo
    // como 1.000.000.000) chegar à aritmética abaixo, mesmo que algum
    // chamador pule a validação.
    const peopleCount =
      Number.isFinite(input.peopleCount) && input.peopleCount > 0
        ? Math.min(Math.max(1, Math.trunc(input.peopleCount)), BILL_SPLIT_MAX_PEOPLE)
        : 1;

    // Divide em centavos exatos usando SOMENTE aritmética inteira — nunca
    // materializa nenhuma estrutura (array, Map, etc.) de tamanho
    // proporcional a `peopleCount`. finalTotal/peopleCount pode não fechar
    // em centavos (ex.: R$100 entre 3 pessoas = R$33,333...), e mostrar
    // R$33,33 para todos faria a soma real paga ficar 1 centavo abaixo do
    // total da conta — em vez disso, calculamos quantas pessoas pagam 1
    // centavo a mais para a soma fechar exatamente.
    const totalCents = Math.round(finalTotal * 100);
    const baseCents = Math.floor(totalCents / peopleCount);
    const extraPeopleCount = totalCents - baseCents * peopleCount;
    const samePeopleCount = peopleCount - extraPeopleCount;

    const equalShares: BillSplitEqualShare[] = [];
    // Maior valor primeiro (quem paga o centavo extra aparece antes).
    if (extraPeopleCount > 0) {
      equalShares.push({ amount: (baseCents + 1) / 100, peopleCount: extraPeopleCount });
    }
    if (samePeopleCount > 0) {
      equalShares.push({ amount: baseCents / 100, peopleCount: samePeopleCount });
    }

    return {
      headline: finalTotal,
      subtotal,
      serviceFeeAmount,
      discountAmount,
      amountPerPerson: equalShares.length === 1 ? equalShares[0].amount : undefined,
      equalShares,
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
  const rawAmountsToPay = validParticipants.map(
    (participant) => participant.amount * adjustmentFactor
  );

  // Mesmo ajuste de centavos do modo "equal": arredondar cada valor de
  // forma independente pode fazer a soma exibida divergir do total em 1
  // centavo (ex.: taxa/desconto quebrando a proporção 60/40 em valores não
  // exatos) — distribuímos o resto pelo maior resto fracionário.
  const totalCents = Math.round(finalTotal * 100);
  const roundedAmounts = distributeCentsExact(rawAmountsToPay, totalCents);

  const participants: BillSplitParticipantResult[] = validParticipants.map(
    (participant, index) => ({
      ...participant,
      amountToPay: roundedAmounts[index],
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
