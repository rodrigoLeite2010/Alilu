// drawPost com o template "Somente imagem": só a imagem do usuário — nunca
// texto, véu escuro ou decoração (ex.: as aspas do "Frase motivacional"),
// mesmo que o estado ainda tenha textos preenchidos de antes.
import { describe, expect, it } from "vitest";
import { drawPost, type RenderingContext2DLike } from "@/lib/instagram/render";
import { applyTemplateToState, createInitialEditorState, updateTextValue } from "@/lib/instagram/editor-state";
import { getFormatById } from "@/lib/instagram/formats";

function recordingContext() {
  const calls: Array<{ name: string; args: unknown[]; fillStyle?: unknown }> = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return (text: string) => ({ width: text.length * 10 });
      if (prop === "createLinearGradient") return () => ({ addColorStop: () => undefined });
      return (...args: unknown[]) => {
        calls.push({ name: prop, args, fillStyle: target.fillStyle });
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as RenderingContext2DLike;
  return { ctx, calls };
}

const image = { naturalWidth: 1080, naturalHeight: 1350 };

describe("drawPost — template 'Somente imagem'", () => {
  it("desenha só a imagem: nenhum texto, nenhum véu, nenhuma aspa decorativa", () => {
    let state = createInitialEditorState("frase-motivacional", "vertical");
    state = updateTextValue(state, "heading", "Texto que não deve aparecer");
    state = {
      ...state,
      backgroundImage: { ...state.backgroundImage, url: "blob:x", naturalWidth: 1080, naturalHeight: 1350, overlayOpacity: 0.4 },
    };
    state = applyTemplateToState(state, "somente-imagem");

    const { ctx, calls } = recordingContext();
    const boxes = drawPost(ctx, getFormatById("vertical"), state, image);

    expect(boxes).toEqual({});
    expect(calls.filter((call) => call.name === "fillText")).toHaveLength(0);
    expect(calls.filter((call) => call.name === "drawImage")).toHaveLength(1);
    const overlay = calls.filter((call) => call.name === "fillRect" && String(call.fillStyle).startsWith("rgba"));
    expect(overlay).toHaveLength(0);
    // O texto continua guardado no estado (volta se o usuário trocar de template).
    expect(state.texts.heading.value).toBe("Texto que não deve aparecer");
  });

  it("o mesmo estado no 'Frase motivacional' desenha as aspas e o texto (comparação)", () => {
    let state = createInitialEditorState("frase-motivacional", "vertical");
    state = updateTextValue(state, "heading", "Com texto");
    const { ctx, calls } = recordingContext();
    drawPost(ctx, getFormatById("vertical"), state, image);
    const texts = calls.filter((call) => call.name === "fillText").map((call) => call.args[0]);
    expect(texts).toContain("“");
    expect(texts).toContain("Com texto");
  });
});
