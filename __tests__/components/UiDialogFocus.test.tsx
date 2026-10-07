import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

function Form() {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  return (
    // onClose é uma arrow nova a cada render, como nas telas reais.
    <Dialog open title="Assinar" onClose={() => undefined}>
      <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>CPF<input value={cpf} onChange={(e) => setCpf(e.target.value)} /></label>
    </Dialog>
  );
}

describe("Dialog compartilhado", () => {
  it("digitar no 2º campo não devolve o foco ao 1º", () => {
    render(<Form />);
    const cpf = screen.getByLabelText("CPF");
    cpf.focus();
    fireEvent.change(cpf, { target: { value: "1" } });
    fireEvent.change(cpf, { target: { value: "12" } });
    expect(document.activeElement).toBe(cpf);
  });
});
