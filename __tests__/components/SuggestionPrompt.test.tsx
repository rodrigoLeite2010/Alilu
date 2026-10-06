import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuggestionPrompt } from "@/components/layout/SuggestionPrompt";

const LAST_SHOWN_KEY = "alilu.suggestionPrompt.lastShownDay";

function localDayKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Aviso "Achou o que procura?": aparece no máximo uma vez por dia. */
describe("SuggestionPrompt — no máximo 1 vez por dia", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("aparece na primeira visita do dia e registra o dia", async () => {
    render(<SuggestionPrompt />);

    expect(await screen.findByText("Achou o que procura?", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(window.localStorage.getItem(LAST_SHOWN_KEY)).toBe(localDayKey());
  });

  it("não volta a aparecer ao recarregar ou abrir outra página no mesmo dia", async () => {
    window.localStorage.setItem(LAST_SHOWN_KEY, localDayKey());
    render(<SuggestionPrompt />);

    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(screen.queryByText("Achou o que procura?")).not.toBeInTheDocument();
  });

  it("volta a aparecer no dia seguinte", async () => {
    window.localStorage.setItem(LAST_SHOWN_KEY, localDayKey(-1));
    render(<SuggestionPrompt />);

    expect(await screen.findByText("Achou o que procura?", {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
