"use client";

import { useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";

const MAX_LENGTH = 20_000;

/**
 * Corretor Ortográfico (categoria Funções String).
 *
 * Este projeto não tem (e esta tarefa não deveria inventar) nenhum motor de
 * correção ortográfica próprio nem uma IA de verdade rodando por trás desta
 * ferramenta — isso seria simular uma funcionalidade que não existe. Em vez
 * disso, seguimos a ordem de prioridade pedida: usamos o recurso nativo do
 * próprio navegador (atributo HTML `spellCheck`), que aciona o corretor
 * ortográfico do sistema operacional/navegador do usuário (o mesmo usado em
 * qualquer campo de texto do Chrome, Firefox, Edge, etc.), sublinhando
 * palavras que o dicionário do usuário não reconhece.
 *
 * Vantagens desse caminho: nenhuma biblioteca externa, nenhuma chamada de
 * rede, e o texto digitado nunca sai do navegador do usuário — o oposto de
 * enviar o texto para um serviço externo de correção.
 */
export function CorretorOrtograficoTool() {
  const [text, setText] = useState("");

  return (
    <div>
      <TextareaField
        id="corretor-ortografico-input"
        label="Digite ou cole o texto"
        placeholder="Digite aqui para ver as palavras sublinhadas pelo corretor do seu navegador..."
        hint={`Máximo de ${MAX_LENGTH.toLocaleString("pt-BR")} caracteres. A correção é feita pelo seu navegador/sistema — nada é enviado a nenhum servidor.`}
        rows={10}
        value={text}
        maxLength={MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        spellCheck
        lang="pt-BR"
      />

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">Como usar</p>
        <p className="mt-1">
          Palavras que o dicionário do seu navegador não reconhecer aparecerão sublinhadas (geralmente
          em vermelho, ondulado). Clique com o botão direito sobre a palavra sublinhada para ver
          sugestões de correção — esse menu é do próprio navegador, não desta página.
        </p>
        <p className="mt-2">
          Se nada for sublinhado, verifique se a correção ortográfica está habilitada nas
          configurações do seu navegador e se o idioma do dicionário instalado é o português.
        </p>
      </div>
    </div>
  );
}
