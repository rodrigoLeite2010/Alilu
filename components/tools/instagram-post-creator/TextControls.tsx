"use client";

import { getTemplateById, TEXT_SLOT_IDS, type TextSlotId } from "@/lib/instagram/templates";
import type { PostEditorState, TextLayerState } from "@/lib/instagram/editor-state";
import { TextLayerControls } from "./TextLayerControls";

/**
 * Área A (textos) do editor: os quatro campos de texto genéricos definidos
 * pelo template ativo (ETAPA 1.3/4). Um campo vazio simplesmente não é
 * desenhado na arte — nenhum espaço reservado fica visível.
 */
export function TextControls({
  state,
  onValueChange,
  onStyleChange,
}: {
  state: PostEditorState;
  onValueChange: (slotId: TextSlotId, value: string) => void;
  onStyleChange: (slotId: TextSlotId, patch: Partial<Omit<TextLayerState, "value">>) => void;
}) {
  const template = getTemplateById(state.templateId);

  return (
    <div className="space-y-4">
      {TEXT_SLOT_IDS.map((slotId) => (
        <TextLayerControls
          key={slotId}
          slotId={slotId}
          config={template.slots[slotId]}
          text={state.texts[slotId]}
          isPill={Boolean(template.slots[slotId].layout.pill)}
          onValueChange={(value) => onValueChange(slotId, value)}
          onStyleChange={(patch) => onStyleChange(slotId, patch)}
        />
      ))}
    </div>
  );
}
