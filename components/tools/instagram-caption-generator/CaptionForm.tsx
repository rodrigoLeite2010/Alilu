"use client";

import type { FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { CAPTION_CONTENT_TYPES, CAPTION_SIZES, CAPTION_STYLES, type CaptionFormInput } from "@/lib/instagram/captions/types";

/**
 * Formulário do Gerador de Legendas (ETAPA 8): assunto, tipo de conteúdo,
 * público-alvo (opcional), estilo, tamanho e chamada para ação (opcional).
 * Nenhum campo aqui depende de conta/login.
 */
export function CaptionForm({
  value,
  onChange,
  onSubmit,
  subjectError,
}: {
  value: CaptionFormInput;
  onChange: (next: CaptionFormInput) => void;
  onSubmit: () => void;
  subjectError?: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        id="instagram-caption-subject"
        label="Assunto"
        placeholder="Ex.: coleção de inverno, aniversário da loja, dica de organização..."
        value={value.subject}
        maxLength={140}
        onChange={(event) => onChange({ ...value, subject: event.target.value })}
        error={subjectError}
        hint={subjectError ? undefined : "Do que é o post? É o único campo obrigatório."}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="instagram-caption-content-type"
          label="Tipo de conteúdo"
          value={value.contentType}
          onChange={(event) =>
            onChange({ ...value, contentType: event.target.value as CaptionFormInput["contentType"] })
          }
        >
          {CAPTION_CONTENT_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="instagram-caption-audience"
          label="Público-alvo (opcional)"
          placeholder="Ex.: mães de primeira viagem, universitários..."
          value={value.audience}
          maxLength={100}
          onChange={(event) => onChange({ ...value, audience: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="instagram-caption-style"
          label="Estilo da legenda"
          value={value.style}
          onChange={(event) => onChange({ ...value, style: event.target.value as CaptionFormInput["style"] })}
        >
          {CAPTION_STYLES.map((style) => (
            <option key={style.id} value={style.id}>
              {style.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="instagram-caption-size"
          label="Tamanho da legenda"
          value={value.size}
          onChange={(event) => onChange({ ...value, size: event.target.value as CaptionFormInput["size"] })}
        >
          {CAPTION_SIZES.map((size) => (
            <option key={size.id} value={size.id}>
              {size.name}
            </option>
          ))}
        </SelectField>
      </div>

      <TextField
        id="instagram-caption-cta"
        label="Chamada para ação (opcional)"
        placeholder="Ex.: Chame no direct, visite nosso site, comente aqui embaixo..."
        value={value.callToAction}
        maxLength={120}
        onChange={(event) => onChange({ ...value, callToAction: event.target.value })}
        hint="Escreva exatamente como quer que apareça — nunca inventamos uma chamada por você."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="instagram-caption-emojis"
          label="Usar emojis"
          value={value.includeEmojis ? "sim" : "nao"}
          onChange={(event) => onChange({ ...value, includeEmojis: event.target.value === "sim" })}
        >
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </SelectField>

        <SelectField
          id="instagram-caption-hashtags"
          label="Sugerir hashtags"
          value={value.includeHashtags ? "sim" : "nao"}
          onChange={(event) => onChange({ ...value, includeHashtags: event.target.value === "sim" })}
        >
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </SelectField>
      </div>

      <Button type="submit" className="w-full justify-center sm:w-auto">
        Gerar legendas
      </Button>
    </form>
  );
}
