import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SongEditor } from "@/components/music/SongEditor";
import { emptySong } from "@/lib/music/types";

it("preenche os campos do editor ao converter uma cifra colada", () => {
  render(<SongEditor initial={{ ...emptySong, id: "draft", revision: 0 }} close={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Importar música" }));
  fireEvent.change(screen.getByLabelText(/Cole letra e cifra/), {
    target: { value: "Yellow\n[**Coldplay**](https://www.cifraclub.com.br/coldplay/)\n**Tom: G (com forma de F)**\n**Capotraste: 2ª casa**\n\n**F**\n\nUma frase de teste" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Converter e revisar" }));

  expect(screen.getByLabelText("Título")).toHaveValue("Yellow");
  expect(screen.getByLabelText("Artista ou compositor")).toHaveValue("Coldplay");
  expect(screen.getByLabelText("Tom em que a cifra foi escrita")).toHaveValue("F");
  expect(screen.getByLabelText("Tom utilizado")).toHaveValue("F");
  expect(screen.getByLabelText("Capotraste")).toHaveValue("2");
  expect(screen.getByLabelText("Fonte")).toHaveValue("Cifra Club");
  expect(screen.getByLabelText("Link de referência")).toHaveValue("https://www.cifraclub.com.br/coldplay/");
  expect(screen.getByRole("button", { name: "Salvar música" })).toBeEnabled();
});
