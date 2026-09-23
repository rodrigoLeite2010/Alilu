import type { ComponentType } from "react";
import { Base64Tool } from "./Base64Tool";
import { base64ToolConfigs, type Base64ToolConfig } from "./base64-tools";

function createBase64ToolComponent(config: Base64ToolConfig): ComponentType {
  function Base64ToolEntry() {
    return <Base64Tool config={config} />;
  }
  Base64ToolEntry.displayName = `Base64Tool(${config.id})`;
  return Base64ToolEntry;
}

/** Componentes das 19 ferramentas Base64, indexados pelo id do catálogo. */
export const base64ToolComponents: Record<string, ComponentType> = Object.fromEntries(
  Object.values(base64ToolConfigs).map((config) => [config.id, createBase64ToolComponent(config)])
);
