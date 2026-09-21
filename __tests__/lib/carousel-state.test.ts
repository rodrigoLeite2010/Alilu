import { describe, expect, it } from "vitest";
import {
  addSlide,
  buildDuplicatedSlide,
  canAddSlide,
  canRemoveSlide,
  cloneBackgroundImage,
  cloneSlideState,
  createInitialCarouselState,
  DEFAULT_CAROUSEL_FORMAT_ID,
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
} from "@/lib/instagram/carousel/carousel-state";
import { updateTextValue } from "@/lib/instagram/editor-state";

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
