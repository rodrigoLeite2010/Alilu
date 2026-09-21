"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold } from "lucide-react";
import { TextField } from "@/components/forms/TextField";
import { TextareaField } from "@/components/forms/TextareaField";
import { SelectField } from "@/components/forms/SelectField";
import { ColorSwatchInput } from "./ColorSwatchInput";
import { POST_FONTS } from "@/lib/instagram/fonts";
import type { TextAlign, TextSlotConfig } from "@/lib/instagram/templates";
import type { TextLayerState } from "@/lib/instagram/editor-state";

const ALIGN_OPTIONS: { value: TextAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Alinhar à esquerda", Icon: AlignLeft },
  { value: "center", label: "Centralizar", Icon: AlignCenter },
  { value: "right", label: "Alinhar à direita", Icon: AlignRight },
];

/**
 * Controles de um único texto do editor (ETAPA 5.1): conteúdo, fonte,
 * tamanho, cor, alinhamento e negrito. Reaproveitado para os quatro textos
 * genéricos do editor (selo, título, texto secundário e rodapé) por
 * TextControls.tsx, um por template (lib/instagram/templates.ts).
 */
export function TextLayerControls({
  slotId,
  config,
  text,
  isPill,
  onValueChange,
  onStyleChange,
}: {
  slotId: string;
  config: TextSlotConfig;
  text: TextLayerState;
  isPill: boolean;
  onValueChange: (value: string) => void;
  onStyleChange: (patch: Partial<Omit<TextLayerState, "value">>) => void;
}) {
  const fieldId = `instagram-post-text-${slotId}`;
  const remaining = config.maxLength - text.value.length;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      {config.multiline ? (
        <TextareaField
          id={fieldId}
          label={config.label}
          placeholder={config.placeholder}
          value={text.value}
          maxLength={config.maxLength}
          onChange={(event) => onValueChange(event.target.value)}
          hint={`${Math.max(0, remaining)} caracteres restantes. Deixe em branco para ocultar este elemento.`}
        />
      ) : (
        <TextField
          id={fieldId}
          label={config.label}
          placeholder={config.placeholder}
          value={text.value}
          maxLength={config.maxLength}
          onChange={(event) => onValueChange(event.target.value)}
          hint={`${Math.max(0, remaining)} caracteres restantes. Deixe em branco para ocultar este elemento.`}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id={`${fieldId}-font`}
          label="Fonte"
          value={text.fontId}
          onChange={(event) => onStyleChange({ fontId: event.target.value })}
        >
          {POST_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </SelectField>

        <div className="block">
          <label htmlFor={`${fieldId}-size`} className="mb-1.5 block text-sm font-medium text-zinc-700">
            Tamanho da fonte
          </label>
          <input
            id={`${fieldId}-size`}
            type="range"
            min={0.6}
            max={1.8}
            step={0.05}
            value={text.fontSizeScale}
            onChange={(event) => onStyleChange({ fontSizeScale: Number(event.target.value) })}
            className="h-11 w-full accent-teal-700"
            aria-valuetext={`${Math.round(text.fontSizeScale * 100)}%`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label={`Alinhamento de ${config.label}`}>
          {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={text.align === value}
              aria-label={label}
              title={label}
              onClick={() => onStyleChange({ align: value })}
              className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                text.align === value
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            aria-pressed={text.bold}
            aria-label="Negrito"
            title="Negrito"
            onClick={() => onStyleChange({ bold: !text.bold })}
            className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              text.bold ? "border-teal-700 bg-teal-50 text-teal-800" : "border-zinc-300 text-zinc-500 hover:bg-zinc-50"
            }`}
          >
            <Bold className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {isPill ? (
          <p className="text-xs text-zinc-500">Usa a cor do selo (seção Cores).</p>
        ) : (
          <ColorSwatchInput
            id={`${fieldId}-color`}
            label="Cor do texto"
            value={text.color}
            onChange={(value) => onStyleChange({ color: value })}
          />
        )}
      </div>
    </div>
  );
}
