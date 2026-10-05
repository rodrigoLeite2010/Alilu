"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { Button } from "@/components/ui/Button";
import { READABILITY_MAX_CHARACTERS, SENTENCE_LENGTH_BANDS, analyzeReadability, type ComplexWordHit, type ReadabilityResult } from "@/lib/text/readability/analyze";
import { buildHighlightSegments } from "@/lib/text/readability/highlight";
import type { ReadabilityLevel } from "@/lib/text/readability/score";
import { RewritePanel } from "./RewritePanel";

/**
 * Legibilidade (categoria Funções String). Análise 100% local e
 * determinística — o texto não sai do navegador e não é salvo.
 * A reescrita com IA (RewritePanel) usa só o backend; a análise continua
 * funcionando sem ela (desligada, sem login ou com erro).
 */

const TXT_MAX_BYTES = 200 * 1024;

const LEVEL_STYLE: Record<ReadabilityLevel, { ring: string; text: string; bar: string }> = {
  MUITO_DIFICIL: { ring: "border-red-200 bg-red-50", text: "text-red-800", bar: "bg-red-500" },
  DIFICIL: { ring: "border-orange-200 bg-orange-50", text: "text-orange-800", bar: "bg-orange-500" },
  MODERADO: { ring: "border-amber-200 bg-amber-50", text: "text-amber-800", bar: "bg-amber-500" },
  FACIL: { ring: "border-teal-200 bg-teal-50", text: "text-teal-800", bar: "bg-teal-600" },
  MUITO_FACIL: { ring: "border-emerald-200 bg-emerald-50", text: "text-emerald-800", bar: "bg-emerald-600" },
};

function quickWordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center">
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function HighlightedText({ text, result }: { text: string; result: ReadabilityResult }) {
  const segments = useMemo(() => buildHighlightSegments(text, result), [text, result]);
  const [selected, setSelected] = useState<ComplexWordHit | null>(null);
  return (
    <div>
      <div className="whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-4 text-base leading-relaxed text-zinc-800" data-testid="readability-highlight">
        {segments.map((segment, index) => {
          const bandClass = segment.band === "MUITO_LONGA" ? "bg-red-100" : segment.band === "LONGA" ? "bg-yellow-100" : "";
          if (segment.word) {
            const word = segment.word;
            const tip = word.suggestion
              ? `Palavra pouco frequente ou potencialmente difícil. Possível substituição: ${word.suggestion}`
              : "Palavra pouco frequente ou potencialmente difícil.";
            return (
              <button
                key={index}
                type="button"
                title={tip}
                onClick={() => setSelected(word)}
                className={`${bandClass} rounded-sm px-0.5 font-medium text-blue-800 underline decoration-blue-400 decoration-2 underline-offset-2 hover:bg-blue-50`}
              >
                {segment.text}
              </button>
            );
          }
          return bandClass ? (
            <span key={index} className={bandClass}>
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          );
        })}
      </div>
      {selected ? (
        <p role="status" className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <strong>“{selected.word}”</strong>: palavra pouco frequente ou potencialmente difícil.
          {selected.suggestion ? (
            <>
              {" "}
              Possível substituição: <strong>{selected.suggestion}</strong>.
            </>
          ) : null}
        </p>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
        <li className="flex items-center gap-1.5">
          <span className="font-medium text-blue-800 underline decoration-blue-400 decoration-2">palavra</span> pouco frequente
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm bg-yellow-100 ring-1 ring-yellow-200" /> frase longa ({SENTENCE_LENGTH_BANDS.attention + 1}–{SENTENCE_LENGTH_BANDS.long} palavras)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm bg-red-100 ring-1 ring-red-200" /> frase muito longa (mais de {SENTENCE_LENGTH_BANDS.long})
        </li>
      </ul>
    </div>
  );
}

export function LegibilidadeTool() {
  const [text, setText] = useState("");
  const [analyzedText, setAnalyzedText] = useState<string | null>(null);
  const [result, setResult] = useState<ReadabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tooLong = text.length > READABILITY_MAX_CHARACTERS;
  const liveWords = useMemo(() => quickWordCount(text), [text]);
  const outdated = result !== null && analyzedText !== text;

  function analyze() {
    setNotice(null);
    if (!text.trim()) {
      setError("Digite um texto para analisar.");
      setResult(null);
      return;
    }
    if (tooLong) {
      setError(`O texto passa do limite de ${formatNumber(READABILITY_MAX_CHARACTERS)} caracteres. Divida em partes menores.`);
      return;
    }
    setError(null);
    setResult(analyzeReadability(text));
    setAnalyzedText(text);
  }

  function clear() {
    setText("");
    setResult(null);
    setAnalyzedText(null);
    setError(null);
    setNotice(null);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Texto copiado.");
    } catch {
      setNotice("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function loadTxt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
      setError("Envie um arquivo .txt.");
      return;
    }
    if (file.size > TXT_MAX_BYTES) {
      setError("O arquivo é grande demais. Use um .txt de até 200 KB.");
      return;
    }
    try {
      setText(await file.text());
      setError(null);
      setResult(null);
    } catch {
      setError("Não foi possível ler o arquivo.");
    }
  }

  const style = result?.level ? LEVEL_STYLE[result.level] : null;

  return (
    <div className="space-y-6">
      <div>
        <TextareaField
          id="legibilidade-input"
          label="Cole ou escreva seu texto"
          placeholder="Digite ou cole aqui o texto que deseja analisar..."
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          error={tooLong ? `Limite de ${formatNumber(READABILITY_MAX_CHARACTERS)} caracteres excedido.` : undefined}
        />
        <p className={`mt-1 text-xs ${tooLong ? "text-red-700" : "text-zinc-500"}`} aria-live="polite">
          {formatNumber(text.length)} / {formatNumber(READABILITY_MAX_CHARACTERS)} caracteres · {formatNumber(liveWords)} palavras
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={analyze} disabled={tooLong} className="justify-center sm:min-w-40">
          Analisar
        </Button>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
          Abrir .txt
          <input type="file" accept=".txt,text/plain" className="sr-only" onChange={(event) => void loadTxt(event)} />
        </label>
        <Button type="button" variant="secondary" onClick={() => void copyText()} disabled={!text} className="justify-center">
          Copiar texto
        </Button>
        <Button type="button" variant="ghost" onClick={clear} disabled={!text && !result} className="justify-center">
          Limpar
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-6" data-testid="readability-result">
          {outdated ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">O texto mudou desde a última análise. Clique em “Analisar” para atualizar.</p>
          ) : null}

          <section className={`rounded-lg border p-5 ${style?.ring ?? "border-zinc-200 bg-zinc-50"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Nota de legibilidade</p>
            {result.score !== null && style ? (
              <>
                <p className={`mt-1 text-4xl font-bold ${style.text}`} data-testid="readability-score">
                  {result.score} <span className="text-lg font-medium text-zinc-500">/ 100</span>
                </p>
                <p className={`text-base font-semibold ${style.text}`}>{result.levelLabel}</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white" aria-hidden>
                  <div className={`h-full ${style.bar}`} style={{ width: `${result.score}%` }} />
                </div>
              </>
            ) : null}
            <p className="mt-3 text-sm text-zinc-700">{result.summary}</p>
          </section>

          {result.words > 0 ? (
            <>
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Palavras" value={formatNumber(result.words)} />
                <StatCard label="Frases" value={formatNumber(result.sentences)} />
                <StatCard label="Palavras complexas" value={`${formatNumber(result.complexWords)} (${formatNumber(result.complexWordsPercent, 1)}%)`} />
                <StatCard label="Frases longas" value={formatNumber(result.longSentences)} />
                <StatCard label="Média palavras/frase" value={formatNumber(result.averageWordsPerSentence, 1)} />
                <StatCard label="Sílabas/palavra" value={formatNumber(result.averageSyllablesPerWord, 2)} />
              </section>

              {result.suggestions.length ? (
                <section>
                  <h2 className="text-base font-semibold text-zinc-900">Sugestões para melhorar</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                    {result.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {analyzedText ? (
                <RewritePanel
                  text={analyzedText}
                  onUseVersion={(newText) => {
                    setText(newText);
                    setResult(analyzeReadability(newText));
                    setAnalyzedText(newText);
                    setNotice(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ) : null}

              <section>
                <h2 className="text-base font-semibold text-zinc-900">Seu texto analisado</h2>
                <p className="mt-1 text-xs text-zinc-500">Toque numa palavra destacada para ver a explicação. O texto original não é alterado.</p>
                <div className="mt-2">
                  <HighlightedText text={analyzedText ?? ""} result={result} />
                </div>
              </section>

              {result.indexReports.length ? (
                <section>
                  <h2 className="text-base font-semibold text-zinc-900">Índices de legibilidade</h2>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {result.indexReports.map((report) => (
                      <div key={report.key} className="rounded-lg border border-zinc-200 bg-white p-4" data-testid={`index-${report.key}`}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-900">{report.label}</p>
                          <p className="text-xl font-bold text-zinc-900">{formatNumber(report.value, 1)}</p>
                        </div>
                        <p className="mt-1 text-sm font-medium text-teal-800">{report.interpretation}</p>
                        <p className="mt-1 text-xs text-zinc-500">{report.explanation}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h2 className="text-base font-semibold text-zinc-900">Mais detalhes</h2>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-700 sm:grid-cols-3">
                  <div><dt className="inline text-zinc-500">Caracteres: </dt><dd className="inline">{formatNumber(result.characters)}</dd></div>
                  <div><dt className="inline text-zinc-500">Sem espaços: </dt><dd className="inline">{formatNumber(result.charactersNoSpaces)}</dd></div>
                  <div><dt className="inline text-zinc-500">Letras: </dt><dd className="inline">{formatNumber(result.letters)}</dd></div>
                  <div><dt className="inline text-zinc-500">Sílabas (estimadas): </dt><dd className="inline">{formatNumber(result.syllables)}</dd></div>
                  <div><dt className="inline text-zinc-500">Parágrafos: </dt><dd className="inline">{formatNumber(result.paragraphs)}</dd></div>
                  <div><dt className="inline text-zinc-500">Maior frase: </dt><dd className="inline">{formatNumber(result.longestSentenceWords)} palavras</dd></div>
                  <div><dt className="inline text-zinc-500">Caracteres/palavra: </dt><dd className="inline">{formatNumber(result.averageCharactersPerWord, 2)}</dd></div>
                </dl>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
