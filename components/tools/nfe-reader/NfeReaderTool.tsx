"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { formatCurrencyBRL } from "@/lib/formatters/currency";
import {
  parseNfeXml,
  type NfeData,
  type NfeParseError,
} from "@/lib/nfe/parse-nfe-xml";

const ERROR_MESSAGES: Record<NfeParseError, string> = {
  empty: "O arquivo selecionado está vazio.",
  "invalid-xml": "Não foi possível ler este arquivo como XML. Verifique se o arquivo não está corrompido.",
  "not-nfe": "Este arquivo não parece ser o XML de uma Nota Fiscal Eletrônica (não foi encontrada a tag infNFe).",
};

/**
 * Limite de tamanho do arquivo XML aceito, verificado ANTES de
 * `FileReader.readAsText`. Um XML de NF-e típico tem poucos KB (raramente
 * passa de algumas centenas de KB, mesmo com muitos itens); 5 MB é uma
 * margem generosa acima disso, suficiente para evitar travar a aba do
 * navegador com um arquivo enorme (ou selecionado por engano) sem arriscar
 * rejeitar uma NF-e legítima.
 */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function formatFileSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");
}

/**
 * Componente principal do Leitor de XML de NF-e. O arquivo é lido
 * inteiramente no navegador com a API nativa FileReader e processado com
 * DOMParser (lib/nfe/parse-nfe-xml.ts) — em nenhum momento o arquivo é
 * enviado para um servidor (PROMPT MESTRE, "Leitor XML NF-e": "Processar XML
 * LOCALMENTE no navegador", "Não fazer upload", "Não executar conteúdo do
 * XML", "Não interpretar XML como HTML").
 */
export function NfeReaderTool() {
  const [data, setData] = useState<NfeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setData(null);
    setError(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `O arquivo selecionado tem ${formatFileSizeMB(file.size)} MB, acima do limite de ${formatFileSizeMB(
          MAX_FILE_SIZE_BYTES
        )} MB aceito por esta ferramenta. Um XML de NF-e costuma ter poucos KB — verifique se o arquivo certo foi selecionado.`
      );
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseNfeXml(text);
      if (result.ok) {
        setData(result.data);
      } else {
        setError(ERROR_MESSAGES[result.error]);
      }
    };
    reader.onerror = () => {
      setError("Não foi possível ler o arquivo selecionado.");
    };
    reader.readAsText(file);
  }

  function handleReset() {
    setData(null);
    setError(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <p className="mb-5 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <strong className="font-medium text-zinc-700 dark:text-zinc-300">Privacidade:</strong> o
        arquivo XML é lido inteiramente no seu navegador. Ele nunca é enviado, salvo ou
        compartilhado com a Alilu ou com qualquer servidor.
      </p>

      <div className="rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <label htmlFor="nfe-file-input" className="cursor-pointer">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Selecione o arquivo XML da NF-e
          </span>
          <input
            ref={inputRef}
            id="nfe-file-input"
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={handleFileChange}
            className="mt-3 block w-full cursor-pointer text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900"
          />
        </label>
        {fileName ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Arquivo: {fileName}</p>
        ) : null}
      </div>

      {error ? (
        <div className="mt-6 space-y-3">
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
          <Button type="button" variant="secondary" onClick={handleReset}>
            Tentar outro arquivo
          </Button>
        </div>
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Número / Série</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {data.number ?? "—"} {data.series ? `/ ${data.series}` : ""}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Data de emissão</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {data.issueDate ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:col-span-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Chave de acesso</p>
              <p className="break-all text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {data.accessKey ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Emitente</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {data.issuer.name ?? "—"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {data.issuer.document ?? "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Destinatário</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {data.recipient.name ?? "—"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {data.recipient.document ?? "—"}
              </p>
            </div>
          </div>

          {data.products.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Produtos
              </h3>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                      <th className="p-2">Código</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2 text-right">Qtd.</th>
                      <th className="p-2">Un.</th>
                      <th className="p-2 text-right">Valor unit.</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((product, index) => (
                      <tr key={index} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="p-2 text-zinc-700 dark:text-zinc-300">
                          {product.code ?? "—"}
                        </td>
                        <td className="p-2 text-zinc-700 dark:text-zinc-300">
                          {product.description ?? "—"}
                        </td>
                        <td className="p-2 text-right text-zinc-700 dark:text-zinc-300">
                          {product.quantity ?? "—"}
                        </td>
                        <td className="p-2 text-zinc-700 dark:text-zinc-300">
                          {product.unit ?? "—"}
                        </td>
                        <td className="p-2 text-right text-zinc-700 dark:text-zinc-300">
                          {product.unitValue !== null ? formatCurrencyBRL(product.unitValue) : "—"}
                        </td>
                        <td className="p-2 text-right font-medium text-zinc-900 dark:text-zinc-50">
                          {product.totalValue !== null ? formatCurrencyBRL(product.totalValue) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Total dos produtos</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {data.totals.productsValue !== null
                  ? formatCurrencyBRL(data.totals.productsValue)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">ICMS</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {data.totals.icmsValue !== null ? formatCurrencyBRL(data.totals.icmsValue) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">IPI</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {data.totals.ipiValue !== null ? formatCurrencyBRL(data.totals.ipiValue) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Valor da NF-e</p>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {data.totals.invoiceValue !== null
                  ? formatCurrencyBRL(data.totals.invoiceValue)
                  : "—"}
              </p>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={handleReset}>
            Ler outro arquivo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
