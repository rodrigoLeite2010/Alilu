"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import {
  centsDigitsToAmount,
  formatCurrencyBRL,
} from "@/lib/formatters/currency";
import {
  formatCpfCnpjMask,
  validateOptionalCpfCnpj,
} from "@/lib/validators/document";
import { isNonEmptyString } from "@/lib/validators/number";
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentMethod,
  type ReceiptInput,
} from "@/lib/receipt/build-receipt";

type FieldErrors = Partial<
  Record<
    | "amount"
    | "payerName"
    | "payerDocument"
    | "reference"
    | "date"
    | "payeeName"
    | "payeeDocument",
    string
  >
>;

/**
 * Data de hoje no formato yyyy-mm-dd (valor nativo de <input type="date">),
 * a partir do relógio do navegador.
 */
function todayISODate(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Formulário do Gerador de Recibo. Todo o processamento acontece aqui, no
 * navegador — nenhum dado preenchido é enviado para servidor, salvo em
 * cookies/localStorage/sessionStorage ou registrado em log (ETAPA 2,
 * seção 2). Ao ser validado com sucesso, chama `onGenerate` com os dados já
 * prontos para lib/receipt/build-receipt.ts montar a prévia.
 */
export function ReceiptForm({
  onGenerate,
}: {
  onGenerate: (input: ReceiptInput) => void;
}) {
  const [amountDigits, setAmountDigits] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerDocument, setPayerDocument] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [city, setCity] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [payeeDocument, setPayeeDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function clearError(field: keyof FieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // O campo de data é não controlado (defaultValue = data atual do
    // navegador, aplicada só na marcação inicial) para que a marcação
    // renderizada no servidor e no cliente seja sempre idêntica — lido aqui
    // via FormData no momento do envio.
    const date = String(new FormData(event.currentTarget).get("date") ?? "");

    const amount = centsDigitsToAmount(amountDigits);
    const payerDocumentCheck = validateOptionalCpfCnpj(payerDocument);
    const payeeDocumentCheck = validateOptionalCpfCnpj(payeeDocument);

    const nextErrors: FieldErrors = {};

    if (amountDigits === "") {
      nextErrors.amount = "Informe o valor do recibo.";
    } else if (amount <= 0) {
      nextErrors.amount = "O valor deve ser maior que zero.";
    }

    if (!isNonEmptyString(payerName)) {
      nextErrors.payerName = "Informe quem efetuou o pagamento.";
    }

    if (!payerDocumentCheck.valid) {
      nextErrors.payerDocument = "CPF ou CNPJ inválido.";
    }

    if (!isNonEmptyString(reference)) {
      nextErrors.reference = "Informe a que se refere o pagamento.";
    }

    if (!isNonEmptyString(date)) {
      nextErrors.date = "Informe a data do recibo.";
    }

    if (!isNonEmptyString(payeeName)) {
      nextErrors.payeeName = "Informe quem está recebendo o pagamento.";
    }

    if (!payeeDocumentCheck.valid) {
      nextErrors.payeeDocument = "CPF ou CNPJ inválido.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onGenerate({
      amount,
      payerName: payerName.trim(),
      payerDocument: payerDocument.trim() || undefined,
      reference: reference.trim(),
      paymentMethod: paymentMethod || undefined,
      date,
      city: city.trim() || undefined,
      payeeName: payeeName.trim(),
      payeeDocument: payeeDocument.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
        <strong className="font-medium text-zinc-700">
          Privacidade:
        </strong>{" "}
        os dados deste recibo são processados somente no seu dispositivo e
        não são armazenados pela Alilu.
      </p>

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-zinc-900">
          Pagamento
        </legend>

        <TextField
          id="receipt-amount"
          label="Valor do recibo"
          inputMode="decimal"
          autoFocus
          placeholder="R$ 0,00"
          value={
            amountDigits
              ? formatCurrencyBRL(centsDigitsToAmount(amountDigits))
              : ""
          }
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 12);
            setAmountDigits(digits);
            clearError("amount");
          }}
          error={errors.amount}
        />

        <TextField
          id="receipt-payer-name"
          label="Recebi de"
          placeholder="Nome ou empresa que efetuou o pagamento"
          value={payerName}
          onChange={(event) => {
            setPayerName(event.target.value);
            clearError("payerName");
          }}
          error={errors.payerName}
        />

        <TextField
          id="receipt-payer-document"
          label="CPF/CNPJ do pagador"
          hint="Opcional"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={payerDocument}
          onChange={(event) => {
            setPayerDocument(formatCpfCnpjMask(event.target.value));
            clearError("payerDocument");
          }}
          error={errors.payerDocument}
        />

        <TextField
          id="receipt-reference"
          label="Referente a"
          placeholder="Ex.: serviços de manutenção"
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
            clearError("reference");
          }}
          error={errors.reference}
        />

        <SelectField
          id="receipt-payment-method"
          label="Forma de pagamento"
          hint="Opcional"
          value={paymentMethod}
          onChange={(event) =>
            setPaymentMethod(event.target.value as PaymentMethod | "")
          }
        >
          <option value="">Selecione (opcional)</option>
          {PAYMENT_METHOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <TextField
          id="receipt-date"
          name="date"
          label="Data"
          type="date"
          defaultValue={todayISODate()}
          onChange={() => clearError("date")}
          error={errors.date}
        />

        <TextField
          id="receipt-city"
          label="Cidade"
          hint="Opcional"
          placeholder="Ex.: São José dos Campos"
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-zinc-900">
          Quem recebe
        </legend>

        <TextField
          id="receipt-payee-name"
          label="Nome do recebedor"
          placeholder="Seu nome ou o nome da sua empresa"
          value={payeeName}
          onChange={(event) => {
            setPayeeName(event.target.value);
            clearError("payeeName");
          }}
          error={errors.payeeName}
        />

        <TextField
          id="receipt-payee-document"
          label="CPF/CNPJ do recebedor"
          hint="Opcional"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={payeeDocument}
          onChange={(event) => {
            setPayeeDocument(formatCpfCnpjMask(event.target.value));
            clearError("payeeDocument");
          }}
          error={errors.payeeDocument}
        />

        <TextareaField
          id="receipt-notes"
          label="Observações"
          hint="Opcional"
          maxLength={300}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </fieldset>

      <Button type="submit" className="w-full sm:w-auto">
        Gerar recibo
      </Button>
    </form>
  );
}
