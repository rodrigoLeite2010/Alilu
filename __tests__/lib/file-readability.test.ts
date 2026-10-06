// @vitest-environment node
// Arquivo do celular que não pode ser lido (nuvem/acesso revogado) é detectado na escolha.
import { afterEach, describe, expect, it, vi } from "vitest";

// Os três caminhos de leitura (blob, FileReader, Response) falham quando o arquivo está ilegível.
function stubUnreadableGlobals(error: Error) {
  vi.stubGlobal("Response", class { arrayBuffer() { return Promise.reject(error); } });
  vi.stubGlobal("FileReader", undefined);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
import { FileNotReadableError, createStallGuard, ensureReadableFile, readFailureReason } from "@/lib/client/file-readability";

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
    stubUnreadableGlobals(new Error("NotReadableError"));
    vi.spyOn(broken, "slice").mockReturnValue({ arrayBuffer: () => Promise.reject(new Error("NotReadableError")) } as unknown as Blob);
    await expect(ensureReadableFile(broken)).rejects.toBeInstanceOf(FileNotReadableError);
  }, 20_000);

  it("registra o motivo real da falha (para a telemetria)", async () => {
    const broken = new File([new Uint8Array(10)], "y.mp4", { type: "video/mp4" });
    const err = Object.assign(new Error("The requested file could not be read"), { name: "NotReadableError" });
    stubUnreadableGlobals(err);
    vi.spyOn(broken, "slice").mockReturnValue({ arrayBuffer: () => Promise.reject(err) } as unknown as Blob);
    const failure = await ensureReadableFile(broken).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(FileNotReadableError);
    expect(readFailureReason(failure)).toContain("blob:NotReadableError: The requested file could not be read");
  }, 20_000);

  it("leitura recusada na hora e liberada logo depois: tenta de novo e funciona", async () => {
    const file = new File([new Uint8Array(500)], "v.mp4", { type: "video/mp4" });
    const realArrayBuffer = file.arrayBuffer.bind(file);
    let calls = 0;
    vi.spyOn(file, "arrayBuffer").mockImplementation(() => (++calls === 1 ? Promise.reject(new Error("NotReadableError")) : realArrayBuffer()));
    const out = await ensureReadableFile(file);
    expect(out.size).toBe(500);
  });

  it("arquivo grande não é copiado (só testa o começo)", async () => {
    const file = new File([new Uint8Array(2000)], "big.mp4", { type: "video/mp4" });
    expect(await ensureReadableFile(file, { materializeUpTo: 1000 })).toBe(file);
  });

  it("pode seguir com o arquivo original quando só a cópia em memória falha", async () => {
    const file = new File([new Uint8Array(500)], "v.mp4", { type: "video/mp4" });
    const err = Object.assign(new Error("The requested file could not be read"), { name: "NotReadableError" });
    const reasons: string[] = [];
    stubUnreadableGlobals(err);
    vi.spyOn(file, "slice").mockReturnValue(new Blob([new Uint8Array(10)], { type: "video/mp4" }));
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(err);
    vi.spyOn(file, "stream").mockReturnValue({
      getReader: () => ({
        read: () => Promise.reject(err),
      }),
    } as unknown as ReturnType<File["stream"]>);

    const out = await ensureReadableFile(file, {
      allowOriginalWhenMaterializeFails: true,
      onMaterializeFailure: (reason) => reasons.push(reason),
    });

    expect(out).toBe(file);
    expect(reasons.join(" ")).toContain("NotReadableError");
  }, 20_000);
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
