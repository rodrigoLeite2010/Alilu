"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidLuhn } from "@/lib/calculators/credit-card-generator";
import { detectCardBrand, CARD_BRAND_DISPLAY_LABELS } from "@/lib/validators/credit-card-brand";

/**
 * Validador de Cartão de Crédito (categoria Validadores). Verifica apenas
 * se o número informado passa no algoritmo de Luhn (reaproveitando
 * isValidLuhn, já usado pelo Gerador de Cartão de Crédito) — NUNCA
 * consulta gateway de pagamento, bandeira ou banco emissor, nem confirma
 * que o cartão existe ou está ativo.
 *
 * RESTRIÇÕES DE SEGURANÇA: esta ferramenta pede apenas o número do
 * cartão — nunca validade, CVV, nome do titular ou data de nascimento. O
 * número digitado nunca é armazenado, transmitido a uma API, salvo em
 * banco de dados ou registrado em log; toda a validação é 100% local.
 */
function maskCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
}

export function ValidadorCartaoCreditoTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [brand, setBrand] = useState<ReturnType<typeof detectCardBrand>>(null);

  function runValidation(current: string) {
    const digits = current.replace(/\D/g, "");
    if (digits.length === 0) {
      setResult(null);
      setBrand(null);
      return;
    }
    setResult(isValidLuhn(digits));
    setBrand(detectCardBrand(digits));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runValidation(value);
  }

  function handleClear() {
    setValue("");
    setResult(null);
    setBrand(null);
  }

  return (
    <div>
      <ValidatorPrivacyNotice>
        Pedimos apenas o número do cartão — nunca validade, CVV, nome do
        titular ou data de nascimento.
      </ValidatorPrivacyNotice>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="validador-cartao-credito-input"
          label="Número do cartão"
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          autoComplete="off"
          maxLength={23}
          value={value}
          onChange={(event) => {
            setValue(maskCardNumber(event.target.value));
            setResult(null);
            setBrand(null);
          }}
          hint="Com ou sem espaços. Nunca peça validade ou CVV para validar um número."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar cartão</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="Número de cartão válido (Luhn)"
            invalidLabel="Número de cartão inválido (Luhn)"
            detail={
              <>
                {result && brand ? (
                  <>
                    Bandeira provável: <strong>{CARD_BRAND_DISPLAY_LABELS[brand]}</strong>.{" "}
                  </>
                ) : null}
                A identificação da bandeira é baseada apenas no padrão numérico
                (prefixo) e não confirma que o cartão exista, esteja ativo ou
                tenha sido de fato emitido.
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
