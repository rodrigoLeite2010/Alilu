// @vitest-environment node
// Arquivo do celular que não pode ser lido (nuvem/acesso revogado) é detectado na escolha.
import { describe, expect, it, vi } from "vitest";
import { FileNotReadableError, createStallGuard, ensureReadableFile } from "@/lib/client/file-readability";

describe("ensureReadableFile", () => {
  it("copia para a memória um arquivo legível", async () => {
    const file = new File([new Uint8Array(1000)], "v.mp4", { type: "video/mp4" });
    const out = await ensureReadableFile(file);
    expect(out).not.toBe(file);
    expect(out.size).toBe(1000);
    expect(out.type).toBe("video/mp4");
  });

  it("recusa arquivo vazio e arquivo cuja leitura falha", async () => {
    await expect(ensureReadableFile(new File([], "x.mp4"))).rejects.toBeInstanceOf(FileNotReadableError);
    const broken = new File([new Uint8Array(10)], "y.mp4", { type: "video/mp4" });
    vi.spyOn(broken, "slice").mockReturnValue({ arrayBuffer: () => Promise.reject(new Error("NotReadableError")) } as unknown as Blob);
    await expect(ensureReadableFile(broken)).rejects.toBeInstanceOf(FileNotReadableError);
  });

  it("arquivo grande não é copiado (só testa o começo)", async () => {
    const file = new File([new Uint8Array(2000)], "big.mp4", { type: "video/mp4" });
    expect(await ensureReadableFile(file, { materializeUpTo: 1000 })).toBe(file);
  });
});

describe("createStallGuard", () => {
  it("aborta quando fica sem progresso e não aborta enquanto há progresso", () => {
    vi.useFakeTimers();
    const guard = createStallGuard(1000);
    vi.advanceTimersByTime(800);
    guard.touch();
    vi.advanceTimersByTime(800);
    expect(guard.signal.aborted).toBe(false);
    vi.advanceTimersByTime(300);
    expect(guard.signal.aborted).toBe(true);
    expect(guard.stalled()).toBe(true);
    vi.useRealTimers();
  });
});
