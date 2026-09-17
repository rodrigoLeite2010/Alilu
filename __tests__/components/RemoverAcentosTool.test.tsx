import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RemoverAcentosTool } from "@/components/tools/remover-acentos/RemoverAcentosTool";

describe("RemoverAcentosTool", () => {
  it("remove os acentos do texto digitado", () => {
    render(<RemoverAcentosTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "São José" },
    });

    const output = screen.getByPlaceholderText(/o texto sem acentos aparece aqui/i) as HTMLTextAreaElement;
    expect(output.value).toBe("Sao Jose");
  });
});
