"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import {
  CERTIFICATE_REGISTRY_TYPE_LABELS,
  type CertificateRegistryType,
} from "@/lib/calculators/certificate-registry-generator";
import {
  isCertificateRegistryFormatValid,
  formatCertificateRegistryInput,
} from "@/lib/validators/certificate-registry";

/**
 * Validador de Certidões (categoria Validadores). A matrícula de registro
 * civil do CNJ é popularmente conhecida como um número de 32 dígitos, mas
 * este projeto não tem acesso à especificação oficial exata da divisão em
 * blocos nem ao cálculo do dígito verificador — reproduzi-los sem uma
 * fonte confirmada seria inventar um algoritmo incorreto. Por isso esta
 * ferramenta confere apenas se o valor tem exatamente 32 dígitos, o
 * comprimento usado pelo registro civil brasileiro (mesmo formato do
 * Gerador de Certidões para Testes) — nunca o dígito verificador.
 */
export function ValidadorCertidoesTool() {
  const [type, setType] = useState<CertificateRegistryType>("nascimento");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string) {
    if (current.replace(/\D/g, "").length === 0) {
      setResult(null);
      return;
    }
    setResult(isCertificateRegistryFormatValid(current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runValidation(value);
  }

  function handleClear() {
    setValue("");
    setResult(null);
  }

  return (
    <div>
      <ValidatorPrivacyNotice />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <SelectField
          id="validador-certidoes-tipo"
          label="Tipo de certidão"
          value={type}
          onChange={(event) => {
            setType(event.target.value as CertificateRegistryType);
            setResult(null);
          }}
        >
          {(Object.entries(CERTIFICATE_REGISTRY_TYPE_LABELS) as [CertificateRegistryType, string][]).map(
            ([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            )
          )}
        </SelectField>

        <TextField
          id="validador-certidoes-matricula"
          label="Número de matrícula"
          placeholder="0000-0000-00-0000-0-00000-000-0000000-00"
          inputMode="numeric"
          autoComplete="off"
          maxLength={39}
          value={value}
          onChange={(event) => {
            setValue(formatCertificateRegistryInput(event.target.value));
            setResult(null);
          }}
          hint="32 dígitos. Aceita com ou sem separadores."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar matrícula</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="Formato de matrícula válido (32 dígitos)"
            invalidLabel="Formato de matrícula inválido"
            detail="Esta ferramenta verifica apenas se o número tem o comprimento de 32 dígitos usado pelo registro civil brasileiro — não confere o dígito verificador nem a divisão oficial em blocos (cartório, ano, livro, folha e termo), e não consulta a Central Nacional de Informações do Registro Civil (CRC Nacional)."
          />
        </div>
      ) : null}
    </div>
  );
}
