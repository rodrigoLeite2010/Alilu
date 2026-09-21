"use client";

import { POST_FORMATS } from "@/lib/instagram/formats";
import { POST_TEMPLATES, type PostTemplateId } from "@/lib/instagram/templates";
import { CAROUSEL_FORMAT_IDS, type CarouselFormatId } from "@/lib/instagram/carousel/carousel-state";
import { CAROUSEL_PRESETS } from "@/lib/instagram/carousel/carousel-presets";

const CAROUSEL_FORMATS = POST_FORMATS.filter((format) =>
  CAROUSEL_FORMAT_IDS.includes(format.id as CarouselFormatId)
);

/**
 * Formato do carrossel inteiro (ETAPA 5: só quadrado e vertical — sem
 * Stories/Reels), template do slide selecionado (ETAPA 2.1, reaproveitando
 * os cinco templates do Criador de Posts) e os cinco modelos prontos de
 * carrossel (ETAPA 7), que substituem todos os slides atuais de uma vez.
 */
export function CarouselStructureControls({
  formatId,
  templateId,
  onFormatChange,
  onTemplateChange,
  onApplyPreset,
}: {
  formatId: CarouselFormatId;
  templateId: PostTemplateId;
  onFormatChange: (formatId: CarouselFormatId) => void;
  onTemplateChange: (templateId: PostTemplateId) => void;
  onApplyPreset: (presetId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Formato do carrossel</p>
        <p className="mb-2 text-xs text-zinc-500">Todos os slides usam o mesmo formato.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAROUSEL_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => onFormatChange(format.id as CarouselFormatId)}
              aria-pressed={formatId === format.id}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                formatId === format.id ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="text-sm font-semibold text-zinc-900">{format.shortLabel}</span>
              <span className="text-xs text-zinc-500">
                {format.width} × {format.height}px
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Template do slide selecionado</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {POST_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onTemplateChange(template.id)}
              aria-pressed={templateId === template.id}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                templateId === template.id ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="text-sm font-semibold text-zinc-900">{template.name}</span>
              <span className="text-xs text-zinc-500">{template.audience}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Modelos prontos de carrossel</p>
        <p className="mb-2 text-xs text-zinc-500">
          Substitui todos os slides atuais por uma sequência pronta — pede confirmação antes.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {CAROUSEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.id)}
              className="flex flex-col items-start gap-1 rounded-lg border border-zinc-300 p-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <span className="text-sm font-semibold text-zinc-900">{preset.name}</span>
              <span className="text-xs text-zinc-500">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
