import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "@/lib/instagram/captions/clipboard";

/** jsdom não implementa document.execCommand — precisa ser criado antes de poder ser mockado/espionado. */
function mockExecCommand(impl: () => boolean) {
  const execCommand = vi.fn(impl);
  Object.assign(document, { execCommand });
  return execCommand;
}

describe("copyTextToClipboard (ETAPA 11)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(document, "execCommand");
  });

  it("usa navigator.clipboard.writeText quando disponível, com o texto exato", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const succeeded = await copyTextToClipboard("Linha 1\n\nLinha 2 com emoji 🎉 #hashtag");

    expect(succeeded).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Linha 1\n\nLinha 2 com emoji 🎉 #hashtag");
  });

  it("cai para o fallback com execCommand quando o Clipboard API não está disponível", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    const execCommandSpy = mockExecCommand(() => true);

    const succeeded = await copyTextToClipboard("Texto de teste");

    expect(execCommandSpy).toHaveBeenCalledWith("copy");
    expect(succeeded).toBe(true);
  });

  it("cai para o fallback quando navigator.clipboard.writeText rejeita (ex.: sem permissão)", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("sem permissão"));
    Object.assign(navigator, { clipboard: { writeText } });
    const execCommandSpy = mockExecCommand(() => true);

    const succeeded = await copyTextToClipboard("Texto de teste");

    expect(writeText).toHaveBeenCalled();
    expect(execCommandSpy).toHaveBeenCalledWith("copy");
    expect(succeeded).toBe(true);
  });

  it("devolve false, sem lançar erro, quando nem o Clipboard API nem o execCommand funcionam", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    mockExecCommand(() => {
      throw new Error("não suportado");
    });

    await expect(copyTextToClipboard("Texto de teste")).resolves.toBe(false);
  });

  it("remove o textarea temporário do DOM depois de copiar (não deixa vazamento)", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    mockExecCommand(() => true);

    await copyTextToClipboard("Texto de teste");

    expect(document.querySelector("textarea")).toBeNull();
  });
});
