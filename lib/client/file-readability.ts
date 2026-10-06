"use client";

/**
 * Celular (Android principalmente): o arquivo escolhido na galeria às vezes
 * NÃO pode ser lido de verdade — vídeo/foto que está só na nuvem (Google
 * Fotos), acesso revogado pelo app de galeria, arquivo ainda sendo gravado.
 * O navegador entrega um File "normal", mas qualquer leitura falha ou fica
 * parada para sempre: a prévia não abre e o upload trava sem erro.
 *
 * ensureReadableFile() testa a leitura logo na escolha e, para arquivos
 * pequenos/médios, copia o conteúdo para a memória (a partir daí o upload
 * não depende mais do app de galeria).
 */

export class FileNotReadableError extends Error {
  /** Motivo técnico (ex.: "NotReadableError", "timeout") — só para telemetria, nunca exibido. */
  reason: string;
  constructor(reason = "unknown") {
    super(
      "O celular não liberou a leitura desse arquivo (acontece quando ele está só na nuvem, como no Google Fotos, ou foi enviado por outro app). Baixe o arquivo para o aparelho ou escolha pelo app “Arquivos” e tente de novo.",
    );
    this.name = "FileNotReadableError";
    this.reason = reason;
  }
}

function describeError(error: unknown): string {
  if (error instanceof FileNotReadableError) return error.reason;
  if (error && typeof error === "object") {
    const { name, message } = error as { name?: unknown; message?: unknown };
    return `${typeof name === "string" ? name : "Error"}${typeof message === "string" && message ? `: ${message}` : ""}`.slice(0, 160);
  }
  return String(error).slice(0, 160);
}

/** Motivo técnico de uma falha de leitura, para a telemetria (sem dados do arquivo). */
export function readFailureReason(error: unknown): string {
  return describeError(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FileNotReadableError("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(new FileNotReadableError(describeError(error)));
      },
    );
  });
}

function readWithFileReader(blob: Blob): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("FileReader sem resultado")));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader falhou"));
    reader.readAsArrayBuffer(blob);
  });
}

async function readWithStream(blob: Blob): Promise<ArrayBuffer> {
  const reader = blob.stream().getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

const RETRY_DELAYS_MS = [0, 800, 1600, 3000, 5000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Lê o blob tentando, em ordem, três caminhos de leitura do navegador e,
 * se todos falharem, espera um instante e tenta de novo (no Android a
 * leitura de um vídeo recém-salvo/escaneado pela galeria às vezes é
 * recusada na hora e funciona logo depois). Junta os motivos de cada falha.
 */
async function readRobust(blob: Blob, timeoutMs: number): Promise<ArrayBuffer> {
  const strategies: Array<[string, () => Promise<ArrayBuffer>]> = [
    ["blob", () => blob.arrayBuffer()],
    ["reader", () => readWithFileReader(blob)],
    ["response", () => new Response(blob).arrayBuffer()],
    ["stream", () => readWithStream(blob)],
  ];
  const reasons: string[] = [];
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);
    for (const [label, read] of strategies) {
      try {
        return await withTimeout(read(), timeoutMs);
      } catch (error) {
        const reason = describeError(error);
        reasons.push(`${label}:${reason}`);
        if (reason === "timeout") throw new FileNotReadableError(reasons.join(" | ").slice(0, 280));
      }
    }
  }
  throw new FileNotReadableError(reasons.join(" | ").slice(0, 280));
}

/** Até este tamanho o arquivo é copiado para a memória (evita depender da galeria durante o envio). */
export const MATERIALIZE_MAX_BYTES = 60 * 1024 * 1024;

export async function ensureReadableFile(
  file: File,
  options: {
    materializeUpTo?: number;
    allowOriginalWhenMaterializeFails?: boolean;
    onMaterializeFailure?: (reason: string) => void;
  } = {},
): Promise<File> {
  if (file.size === 0) throw new FileNotReadableError("empty");
  // 1) Lê o começo: falha/trava = arquivo inacessível.
  await readRobust(file.slice(0, 64 * 1024), 10_000);
  // 2) Copia para a memória quando cabe — o upload passa a ler da memória.
  const limit = options.materializeUpTo ?? MATERIALIZE_MAX_BYTES;
  if (file.size > limit) return file;
  let bytes: ArrayBuffer;
  try {
    bytes = await readRobust(file, Math.max(15_000, Math.ceil(file.size / (1024 * 1024)) * 1_500));
  } catch (error) {
    if (!options.allowOriginalWhenMaterializeFails) throw error;
    options.onMaterializeFailure?.(describeError(error));
    return file;
  }
  if (bytes.byteLength !== file.size) throw new FileNotReadableError(`size ${bytes.byteLength}/${file.size}`);
  return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
}

/**
 * AbortController que dispara se o envio ficar parado (sem progresso) por
 * `idleMs`. Chame `touch()` a cada evento de progresso e `done()` no fim.
 */
export function createStallGuard(idleMs = 60_000): { signal: AbortSignal; touch: () => void; done: () => void; stalled: () => boolean } {
  const controller = new AbortController();
  let stalledFlag = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      stalledFlag = true;
      controller.abort();
    }, idleMs);
  };
  arm();
  return {
    signal: controller.signal,
    touch: arm,
    done: () => {
      if (timer) clearTimeout(timer);
    },
    stalled: () => stalledFlag,
  };
}
