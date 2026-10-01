import { describe, expect, it } from "vitest";
import {
  addSlide,
  buildDuplicatedSlide,
  canAddSlide,
  canRemoveSlide,
  cloneBackgroundImage,
  cloneSlideState,
  createCarouselStateFromImages,
  createInitialCarouselState,
  DEFAULT_CAROUSEL_FORMAT_ID,
  GENERATED_CAROUSEL_TEMPLATE_ID,
  GENERATED_CAROUSEL_TEXT_SLOT,
  getSelectedSlide,
  insertSlideAfter,
  INITIAL_CAROUSEL_SLIDES,
  MAX_CAROUSEL_SLIDES,
  moveSlideDown,
  moveSlideUp,
  releaseAllSlideImages,
  releaseSlideImage,
  removeSlide,
  reorderSlides,
  selectSlide,
  setCarouselFormat,
  updateSelectedSlideState,
  type CarouselImageSlideInput,
} from "@/lib/instagram/carousel/carousel-state";
import { updateTextValue, type BackgroundImageState } from "@/lib/instagram/editor-state";
import { buildSeedBackgroundImage } from "@/lib/instagram/carousel/auto-carousel";

describe("carousel-state — criação e limites (ETAPA 2/5)", () => {
  it("cria o estado inicial com 5 slides editáveis, ids únicos e ordem crescente", () => {
    const state = createInitialCarouselState();
    expect(state.slides).toHaveLength(INITIAL_CAROUSEL_SLIDES);
    expect(state.formatId).toBe(DEFAULT_CAROUSEL_FORMAT_ID);

    const ids = state.slides.map((slide) => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    state.slides.forEach((slide, index) => expect(slide.order).toBe(index));
    expect(state.selectedSlideId).toBe(state.slides[0].id);
  });

  it("canRemoveSlide fica falso com apenas 1 slide, e canAddSlide fica falso com 20 slides", () => {
    const oneSlide = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 1);
    expect(canRemoveSlide(oneSlide)).toBe(false);
    expect(canAddSlide(oneSlide)).toBe(true);

    const maxSlides = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, MAX_CAROUSEL_SLIDES);
    expect(maxSlides.slides).toHaveLength(MAX_CAROUSEL_SLIDES);
    expect(canAddSlide(maxSlides)).toBe(false);
  });
});

describe("carousel-state — adicionar, duplicar e excluir slides (ETAPA 2/3)", () => {
  it("addSlide insere logo após o slide selecionado, seleciona o novo slide e nunca ultrapassa 20", () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 2);
    const firstId = state.slides[0].id;
    state = selectSlide(state, firstId);
    state = addSlide(state);

    expect(state.slides).toHaveLength(3);
    expect(state.slides[0].id).toBe(firstId);
    expect(state.slides[1].id).toBe(state.selectedSlideId);

    let maxState = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, MAX_CAROUSEL_SLIDES);
    maxState = addSlide(maxState);
    expect(maxState.slides).toHaveLength(MAX_CAROUSEL_SLIDES);
  });

  it("removeSlide nunca remove o último slide restante", () => {
    const oneSlide = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 1);
    const result = removeSlide(oneSlide, oneSlide.slides[0].id);
    expect(result).toBe(oneSlide);
    expect(result.slides).toHaveLength(1);
  });

  it("removeSlide corrige a seleção quando o slide removido era o selecionado, sem alterar o conteúdo dos outros slides", () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 3);
    const [first, second, third] = state.slides;

    state = updateSelectedSlideState(selectSlide(state, second.id), (s) =>
      updateTextValue(s, "heading", "Slide 2 editado")
    );
    state = updateSelectedSlideState(selectSlide(state, third.id), (s) =>
      updateTextValue(s, "heading", "Slide 3 editado")
    );

    state = selectSlide(state, second.id);
    const afterRemoval = removeSlide(state, second.id);

    expect(afterRemoval.slides.map((slide) => slide.id)).toEqual([first.id, third.id]);
    expect(afterRemoval.slides.find((slide) => slide.id === third.id)?.state.texts.heading.value).toBe(
      "Slide 3 editado"
    );
    expect(afterRemoval.selectedSlideId).toBe(third.id);
    afterRemoval.slides.forEach((slide, index) => expect(slide.order).toBe(index));
  });

  it("insertSlideAfter respeita o limite máximo de 20 slides", () => {
    const maxState = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, MAX_CAROUSEL_SLIDES);
    const newSlide = buildDuplicatedSlide(maxState.slides[0].state);
    const result = insertSlideAfter(maxState, maxState.slides[0].id, newSlide);
    expect(result.slides).toHaveLength(MAX_CAROUSEL_SLIDES);
  });

  it("cloneSlideState/buildDuplicatedSlide criam um slide com id novo e objetos de texto independentes (cópia profunda)", async () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 1);
    state = updateSelectedSlideState(state, (s) => updateTextValue(s, "heading", "Original"));
    const original = state.slides[0];

    const clonedState = await cloneSlideState(original.state);
    const duplicated = buildDuplicatedSlide(clonedState);

    expect(duplicated.id).not.toBe(original.id);
    expect(duplicated.state.texts).not.toBe(original.state.texts);
    expect(duplicated.state.texts.heading).not.toBe(original.state.texts.heading);
    expect(duplicated.state.texts.heading.value).toBe("Original");

    const editedClone = updateTextValue(duplicated.state, "heading", "Editado só na cópia");
    expect(editedClone.texts.heading.value).toBe("Editado só na cópia");
    expect(original.state.texts.heading.value).toBe("Original");
  });

  it("cloneBackgroundImage retorna a mesma imagem (por valor) quando não há url para clonar", async () => {
    const state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 1);
    const cloned = await cloneBackgroundImage(state.slides[0].state.backgroundImage);
    expect(cloned).toEqual(state.slides[0].state.backgroundImage);
  });

  it("releaseSlideImage/releaseAllSlideImages não lançam erro quando não há imagem carregada", () => {
    const state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 2);
    expect(() => releaseSlideImage(state.slides[0])).not.toThrow();
    expect(() => releaseSlideImage(undefined)).not.toThrow();
    expect(() => releaseAllSlideImages(state)).not.toThrow();
  });
});

describe("carousel-state — edição independente por slide (ETAPA 3)", () => {
  it("updateSelectedSlideState só altera o slide selecionado — os demais mantêm a mesma referência de objeto", () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 3);
    const untouchedRefs = state.slides.map((slide) => slide.state);

    state = updateSelectedSlideState(state, (s) => updateTextValue(s, "heading", "Editado só no slide 1"));

    expect(state.slides[0].state.texts.heading.value).toBe("Editado só no slide 1");
    expect(state.slides[1].state).toBe(untouchedRefs[1]);
    expect(state.slides[2].state).toBe(untouchedRefs[2]);
  });

  it("mudar de slide selecionado preserva o conteúdo editado ao navegar de volta", () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 2);
    const [first, second] = state.slides;

    state = updateSelectedSlideState(state, (s) => updateTextValue(s, "heading", "Conteúdo do slide 1"));
    state = selectSlide(state, second.id);
    state = updateSelectedSlideState(state, (s) => updateTextValue(s, "heading", "Conteúdo do slide 2"));
    state = selectSlide(state, first.id);

    expect(getSelectedSlide(state).state.texts.heading.value).toBe("Conteúdo do slide 1");
    expect(state.slides.find((slide) => slide.id === second.id)?.state.texts.heading.value).toBe(
      "Conteúdo do slide 2"
    );
  });

  it("getSelectedSlide cai para o primeiro slide como fallback se o id selecionado não existir mais", () => {
    const state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 2);
    const broken = { ...state, selectedSlideId: "id-inexistente" };
    expect(getSelectedSlide(broken)).toBe(state.slides[0]);
  });
});

describe("carousel-state — reordenação (ETAPA 4)", () => {
  it("reorderSlides/moveSlideUp/moveSlideDown preservam o conteúdo e atualizam a numeração", () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 3);
    state = updateSelectedSlideState(state, (s) => updateTextValue(s, "heading", "Conteúdo do primeiro slide"));
    const [first, second, third] = state.slides;

    const reordered = reorderSlides(state, 0, 2);
    expect(reordered.slides.map((slide) => slide.id)).toEqual([second.id, third.id, first.id]);
    expect(reordered.slides.find((slide) => slide.id === first.id)?.state.texts.heading.value).toBe(
      "Conteúdo do primeiro slide"
    );
    reordered.slides.forEach((slide, index) => expect(slide.order).toBe(index));

    const movedDown = moveSlideDown(state, first.id);
    expect(movedDown.slides.map((slide) => slide.id)).toEqual([second.id, first.id, third.id]);

    const movedUp = moveSlideUp(movedDown, first.id);
    expect(movedUp.slides.map((slide) => slide.id)).toEqual([first.id, second.id, third.id]);
  });

  it("reorderSlides preserva a seleção ativa mesmo quando o slide selecionado muda de posição", () => {
    let state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 3);
    const secondId = state.slides[1].id;
    state = selectSlide(state, secondId);

    const reordered = reorderSlides(state, 1, 0);
    expect(reordered.selectedSlideId).toBe(secondId);
    expect(reordered.slides[0].id).toBe(secondId);
  });

  it("moveSlideUp no primeiro slide e moveSlideDown no último não alteram a lista", () => {
    const state = createInitialCarouselState(DEFAULT_CAROUSEL_FORMAT_ID, 3);
    const first = state.slides[0].id;
    const last = state.slides[state.slides.length - 1].id;

    expect(moveSlideUp(state, first)).toBe(state);
    expect(moveSlideDown(state, last)).toBe(state);
  });
});

describe("carousel-state — formato do carrossel (ETAPA 5)", () => {
  it("setCarouselFormat aplica o novo formato a todos os slides de uma vez", () => {
    const state = createInitialCarouselState();
    const otherFormat = DEFAULT_CAROUSEL_FORMAT_ID === "quadrado" ? "vertical" : "quadrado";

    const result = setCarouselFormat(state, otherFormat);
    expect(result.formatId).toBe(otherFormat);
    result.slides.forEach((slide) => expect(slide.state.formatId).toBe(otherFormat));
  });
});


describe("carousel-state — modo 'Várias imagens': createCarouselStateFromImages", () => {
  function seed(fileName: string): BackgroundImageState {
    return buildSeedBackgroundImage({ url: `blob:${fileName}`, fileName, naturalWidth: 1080, naturalHeight: 1080 });
  }

  it("gera um slide por imagem, na mesma ordem recebida, sem nenhuma imagem global compartilhada", () => {
    const inputs: CarouselImageSlideInput[] = [
      { image: seed("1.jpg"), caption: "" },
      { image: seed("2.jpg"), caption: "" },
      { image: seed("3.jpg"), caption: "" },
    ];

    const state = createCarouselStateFromImages(inputs, DEFAULT_CAROUSEL_FORMAT_ID);

    expect(state.slides).toHaveLength(3);
    expect(state.slides.map((slide) => slide.state.backgroundImage.fileName)).toEqual(["1.jpg", "2.jpg", "3.jpg"]);
    // Cada slide é dono do PRÓPRIO objeto de imagem (mesma referência da entrada, nunca clonada/compartilhada).
    state.slides.forEach((slide, index) => {
      expect(slide.state.backgroundImage).toBe(inputs[index].image);
    });
    expect(state.selectedSlideId).toBe(state.slides[0].id);
    // originalText fica indefinido de propósito — não existe um texto único de origem para "Redistribuir"/"Editar texto original".
    expect(state.originalText).toBeUndefined();
  });

  it("sem legenda usa 'Somente imagem'; com legenda usa o template gerado com a legenda no slot de texto", () => {
    const state = createCarouselStateFromImages(
      [
        { image: seed("a.jpg"), caption: "" },
        { image: seed("b.jpg"), caption: "Minha legenda" },
      ],
      DEFAULT_CAROUSEL_FORMAT_ID
    );

    expect(state.slides[0].state.templateId).toBe("somente-imagem");
    expect(state.slides[0].state.texts[GENERATED_CAROUSEL_TEXT_SLOT].value).toBe("");
    expect(state.slides[1].state.templateId).toBe(GENERATED_CAROUSEL_TEMPLATE_ID);
    expect(state.slides[1].state.texts[GENERATED_CAROUSEL_TEXT_SLOT].value).toBe("Minha legenda");
  });

  it("alterar a imagem de um slide depois de gerado nunca afeta os outros (Seções 12/13/14)", () => {
    const state = createCarouselStateFromImages(
      [
        { image: seed("1.jpg"), caption: "" },
        { image: seed("2.jpg"), caption: "" },
        { image: seed("3.jpg"), caption: "" },
      ],
      DEFAULT_CAROUSEL_FORMAT_ID
    );

    const secondSlideId = state.slides[1].id;
    const selected = { ...state, selectedSlideId: secondSlideId };
    const updated = updateSelectedSlideState(selected, (slideState) => ({
      ...slideState,
      backgroundImage: seed("novo.jpg"),
    }));

    expect(updated.slides[1].state.backgroundImage.fileName).toBe("novo.jpg");
    expect(updated.slides[0].state.backgroundImage.fileName).toBe("1.jpg");
    expect(updated.slides[2].state.backgroundImage.fileName).toBe("3.jpg");
    // Slides não afetados mantêm a MESMA referência de objeto (garantia estrutural do updateSelectedSlideState).
    expect(updated.slides[0]).toBe(state.slides[0]);
    expect(updated.slides[2]).toBe(state.slides[2]);
  });

  it("lança um erro claro quando nenhuma imagem é fornecida", () => {
    expect(() => createCarouselStateFromImages([], DEFAULT_CAROUSEL_FORMAT_ID)).toThrow(
      "createCarouselStateFromImages: nenhuma imagem para gerar slides."
    );
  });

  it("respeita o formato escolhido em todos os slides gerados", () => {
    const otherFormat = DEFAULT_CAROUSEL_FORMAT_ID === "quadrado" ? "vertical" : "quadrado";
    const state = createCarouselStateFromImages([{ image: seed("1.jpg"), caption: "" }], otherFormat);

    expect(state.formatId).toBe(otherFormat);
    expect(state.slides[0].state.formatId).toBe(otherFormat);
  });
});

describe("carousel-state — applyTemplateToAllSlides", () => {
  it("aplica o template a todos os slides, preservando a imagem de cada um", async () => {
    const { applyTemplateToAllSlides } = await import("@/lib/instagram/carousel/carousel-state");
    const seedImage = (fileName: string) =>
      buildSeedBackgroundImage({ url: `blob:${fileName}`, fileName, naturalWidth: 1080, naturalHeight: 1080 });
    const state = createCarouselStateFromImages(
      [
        { image: seedImage("1.jpg"), caption: "Legenda 1" },
        { image: seedImage("2.jpg"), caption: "Legenda 2" },
      ],
      DEFAULT_CAROUSEL_FORMAT_ID
    );

    const updated = applyTemplateToAllSlides(state, "somente-imagem");

    expect(updated.slides.map((slide) => slide.state.templateId)).toEqual(["somente-imagem", "somente-imagem"]);
    expect(updated.slides.map((slide) => slide.state.backgroundImage.fileName)).toEqual(["1.jpg", "2.jpg"]);
    // Aplicar de novo o mesmo template não muda nada (mesma referência).
    expect(applyTemplateToAllSlides(updated, "somente-imagem")).toBe(updated);
  });
});
