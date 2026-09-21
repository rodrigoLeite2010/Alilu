"use client";

import { POST_FORMATS, type PostFormatId } from "@/lib/instagram/formats";
import { POST_TEMPLATES, type PostTemplateId } from "@/lib/instagram/templates";

/**
 * Seleção de formato (ETAPA 3) e template (ETAPA 4). Trocar de formato ou
 * template nunca perde o conteúdo já digitado — ver
 * lib/instagram/editor-state.ts (applyTemplateToState).
 */
export function StructureControls({
  formatId,
  templateId,
  onFormatChange,
  onTemplateChange,
}: {
  formatId: PostFormatId;
  templateId: PostTemplateId;
  onFormatChange: (formatId: PostFormatId) => void;
  onTemplateChange: (templateId: PostTemplateId) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Formato da imagem</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {POST_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => onFormatChange(format.id)}
              aria-pressed={formatId === format.id}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                formatId === format.id
                  ? "border-teal-700 bg-teal-50"
                  : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="text-sm font-semibold text-zinc-900">{format.shortLabel}</span>
              <span className="text-xs text-zinc-500">{format.width} × {format.height}px</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Template</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {POST_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onTemplateChange(template.id)}
              aria-pressed={templateId === template.id}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                templateId === template.id
                  ? "border-teal-700 bg-teal-50"
                  : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="text-sm font-semibold text-zinc-900">{template.name}</span>
              <span className="text-xs text-zinc-500">{template.audience}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
