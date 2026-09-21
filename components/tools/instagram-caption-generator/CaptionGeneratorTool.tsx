"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createDefaultCaptionFormInput, type CaptionFormInput, type GeneratedCaption } from "@/lib/instagram/captions/types";
import { generateCaptions } from "@/lib/instagram/captions/generate";
import { CaptionForm } from "./CaptionForm";
import { CaptionResultCard } from "./CaptionResultCard";

/**
 * Componente principal do Gerador de Legendas (Fase 2, ETAPA 8-12). Toda a
 * "geração" acontece localmente, combinando modelos de texto prontos com
 * os dados do formulário — nunca promete geração por inteligência
 * artificial (ETAPA 8/11).
 */
export function CaptionGeneratorTool() {
  const [formInput, setFormInput] = useState<CaptionFormInput>(createDefaultCaptionFormInput);
  const [subjectError, setSubjectError] = useState<string | undefined>(undefined);
  const [captions, setCaptions] = useState<GeneratedCaption[] | null>(null);
  const [seed, setSeed] = useState(0);

  // ETAPA 12: assunto compartilhado com segurança via parâmetro de URL, sem
  // nenhum dado pessoal — só o texto que o próprio usuário já digitou no
  // Criador de Carrosséis, se ele veio de lá. Lido em um efeito (não no
  // valor inicial do useState) de propósito: a página é pré-renderizada de
  // forma estática, então `window` não existe na primeira renderização no
  // servidor — ler a URL ali causaria um valor divergente da hidratação.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subjectFromQuery = params.get("assunto");
    if (subjectFromQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com um sistema externo (URL) só uma vez, após a hidratação; não é estado derivado de props/state internos.
      setFormInput((prev) => ({ ...prev, subject: subjectFromQuery }));
    }
  }, []);

  function handleGenerate() {
    const subject = formInput.subject.trim();
    if (subject.length === 0) {
      setSubjectError("Digite o assunto do post para gerar as legendas.");
      setCaptions(null);
      return;
    }

    setSubjectError(undefined);
    setSeed(0);
    setCaptions(generateCaptions(formInput, 0));
  }

  function handleRegenerate() {
    if (!captions) return;
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    setCaptions(generateCaptions(formInput, nextSeed));
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-20">
        <CaptionForm value={formInput} onChange={setFormInput} onSubmit={handleGenerate} subjectError={subjectError} />

        <p className="mt-4 text-center text-xs text-zinc-500 lg:text-left">
          Prefere montar um post ou um carrossel?{" "}
          <Link href="/instagram/criar-post" className="font-medium text-teal-800 hover:underline">
            Criador de Posts
          </Link>{" "}
          ·{" "}
          <Link href="/instagram/carrossel" className="font-medium text-teal-800 hover:underline">
            Criador de Carrosséis
          </Link>
        </p>
      </div>

      <div className="space-y-4">
        {captions ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-zinc-600">{captions.length} opções de legenda, prontas para editar e copiar.</p>
              <Button type="button" variant="secondary" onClick={handleRegenerate}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Gerar novas opções
              </Button>
            </div>
            {captions.map((caption, index) => (
              <CaptionResultCard key={caption.id} caption={caption} index={index} />
            ))}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-6 text-center text-sm text-zinc-500">
            Preencha o assunto e clique em &quot;Gerar legendas&quot; para ver as opções aqui.
          </div>
        )}
      </div>
    </div>
  );
}
