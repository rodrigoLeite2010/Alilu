"use client";

/**
 * Telemetria de upload no navegador (principalmente celular). Registra cada
 * etapa — seletor aberto, arquivo recebido, validação, envio, erro — em
 * /api/client-events (tabela client_upload_events). Só metadados; nunca o
 * conteúdo nem o nome do arquivo. Nunca lança erro nem atrasa a tela.
 */

export type UploadTool = "ai-video-image" | "ai-video-logo" | "split-screen" | "reels" | "instagram-import" | "media-picker";
export type UploadStage =
  | "picker_open"
  | "file_selected"
  | "no_file"
  | "validation_error"
  | "prepare_done"
  | "upload_start"
  | "upload_done"
  | "upload_error"
  | "metadata_loaded"
  | "metadata_error"
  | "page_reloaded_during_picker"
  | "upload_fallback"
  | "processing_error";

const PICKER_MARK_KEY = "alilu.upload.pickerOpen";

let pageSession: string | null = null;
function getPageSession(): string {
  if (!pageSession) pageSession = Math.random().toString(36).slice(2, 12);
  return pageSession;
}

export function describeFile(file: File | null | undefined): { fileType: string | null; fileExt: string | null; fileSize: number | null } {
  if (!file) return { fileType: null, fileExt: null, fileSize: null };
  const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase().slice(0, 10) : "";
  return { fileType: file.type || "", fileExt: ext || null, fileSize: file.size };
}

export function trackUpload(tool: UploadTool, stage: UploadStage, details: { file?: File | null; message?: string | null } = {}): void {
  try {
    const body = JSON.stringify({
      tool,
      stage,
      ...describeFile(details.file),
      message: details.message ? String(details.message).slice(0, 300) : null,
      pageSession: getPageSession(),
      page: typeof location !== "undefined" ? location.pathname : null,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/client-events", blob)) return;
    void fetch("/api/client-events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
  } catch {
    // telemetria nunca atrapalha
  }
}

/**
 * Marca que o seletor de arquivos foi aberto. Em celulares com pouca memória
 * o navegador às vezes é encerrado enquanto a galeria está aberta e a página
 * recarrega sem o arquivo ("escolhi o vídeo e nada aconteceu"). Ao montar a
 * tela, checkReloadDuringPicker() detecta isso e avisa a pessoa.
 */
export function markPickerOpen(tool: UploadTool): void {
  trackUpload(tool, "picker_open");
  try {
    sessionStorage.setItem(PICKER_MARK_KEY, JSON.stringify({ tool, at: Date.now() }));
  } catch {
    // sem sessionStorage
  }
}

export function clearPickerMark(): void {
  try {
    sessionStorage.removeItem(PICKER_MARK_KEY);
  } catch {
    // sem sessionStorage
  }
}

/** true se a página recarregou com o seletor aberto há pouco (até 10 min). */
export function checkReloadDuringPicker(tool: UploadTool): boolean {
  try {
    const raw = sessionStorage.getItem(PICKER_MARK_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(PICKER_MARK_KEY);
    const mark = JSON.parse(raw) as { tool?: string; at?: number };
    if (mark.tool !== tool || typeof mark.at !== "number" || Date.now() - mark.at > 10 * 60_000) return false;
    trackUpload(tool, "page_reloaded_during_picker");
    return true;
  } catch {
    return false;
  }
}

/** Mensagem mostrada quando a página recarregou durante a escolha do arquivo. */
export const RELOADED_DURING_PICKER_MESSAGE =
  "Parece que o celular recarregou a página enquanto a galeria estava aberta (falta de memória). Feche outros apps e tente escolher o arquivo de novo.";
