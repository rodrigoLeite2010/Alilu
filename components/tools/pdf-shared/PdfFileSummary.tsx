"use client";

import { FileText, Trash2 } from "lucide-react";
import { formatPdfFileSize } from "@/lib/pdf/merge-pdfs";

type PdfFileSummaryProps = {
  file: File;
  pageCount: number;
  disabled?: boolean;
  onClear: () => void;
};

export function PdfFileSummary({
  file,
  pageCount,
  disabled = false,
  onClear,
}: PdfFileSummaryProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-teal-700">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="break-all text-sm font-medium text-zinc-900">{file.name}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {formatPdfFileSize(file.size)} - {pageCount} {pageCount === 1 ? "página" : "páginas"}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        title="Remover arquivo"
        aria-label={`Remover ${file.name}`}
        onClick={onClear}
        disabled={disabled}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
