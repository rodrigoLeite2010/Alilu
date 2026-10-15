import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Dialog as InstagramDialog } from "@/components/instagram/Dialog";

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
  it.each([Dialog, InstagramDialog])("mantém Tab e Shift+Tab dentro do modal", (Modal) => {
    render(<><button>Fora</button><Modal open title="Teste" onClose={() => undefined}><button>Primeiro</button><button>Último</button></Modal></>);
    const first = screen.getByRole("button", { name: "Fechar" });
    const last = screen.getByRole("button", { name: "Último" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
  it("digitar no 2º campo não devolve o foco ao 1º", () => {
    render(<Form />);
    const cpf = screen.getByLabelText("CPF");
    cpf.focus();
    fireEvent.change(cpf, { target: { value: "1" } });
    fireEvent.change(cpf, { target: { value: "12" } });
    expect(document.activeElement).toBe(cpf);
  });
});
