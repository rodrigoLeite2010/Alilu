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
  constructor() {
    super(
      "O celular não liberou a leitura desse arquivo (acontece quando ele está só na nuvem, como no Google Fotos, ou foi enviado por outro app). Baixe o arquivo para o aparelho ou escolha pelo app “Arquivos” e tente de novo.",
    );
    this.name = "FileNotReadableError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FileNotReadableError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        reject(new FileNotReadableError());
      },
    );
  });
}

/** Até este tamanho o arquivo é copiado para a memória (evita depender da galeria durante o envio). */
export const MATERIALIZE_MAX_BYTES = 60 * 1024 * 1024;

export async function ensureReadableFile(file: File, options: { materializeUpTo?: number } = {}): Promise<File> {
  if (file.size === 0) throw new FileNotReadableError();
  // 1) Lê o começo: falha/trava = arquivo inacessível.
  await withTimeout(file.slice(0, 64 * 1024).arrayBuffer(), 10_000);
  // 2) Copia para a memória quando cabe — o upload passa a ler da memória.
  const limit = options.materializeUpTo ?? MATERIALIZE_MAX_BYTES;
  if (file.size > limit) return file;
  const bytes = await withTimeout(file.arrayBuffer(), Math.max(15_000, Math.ceil(file.size / (1024 * 1024)) * 1_500));
  if (bytes.byteLength !== file.size) throw new FileNotReadableError();
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
