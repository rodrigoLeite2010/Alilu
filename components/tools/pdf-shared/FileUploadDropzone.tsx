"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

type FileUploadDropzoneProps = {
  inputId: string;
  title: string;
  description: string;
  limitDescription: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel: string;
  onFilesSelected: (files: File[]) => void;
};

/**
 * Área de seleção local reutilizada pelas ferramentas de PDF. A validação do
 * conteúdo fica na ferramenta chamadora, porque cada fluxo aceita formatos e
 * limites diferentes.
 */
export function FileUploadDropzone({
  inputId,
  title,
  description,
  limitDescription,
  accept,
  multiple = false,
  disabled = false,
  buttonLabel,
  onFilesSelected,
}: FileUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);
  const descriptionId = `${inputId}-description`;
  const limitId = `${inputId}-limit`;

  function submitFiles(files: File[]) {
    if (!disabled && files.length > 0) {
      onFilesSelected(files);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    submitFiles(Array.from(event.target.files ?? []));
    // Permite selecionar novamente o mesmo arquivo depois de removê-lo.
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDropTargetActive(false);
    submitFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div
      className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
        isDropTargetActive
          ? "border-teal-600 bg-teal-50"
          : "border-zinc-300 bg-zinc-50/70"
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setIsDropTargetActive(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDropTargetActive(false);
        }
      }}
      onDrop={handleDrop}
    >
      <FileText className="mx-auto size-10 text-teal-700" aria-hidden />
      <p className="mt-3 text-base font-semibold text-zinc-900">{title}</p>
      <p id={descriptionId} className="mt-1 text-sm text-zinc-600">
        {description}
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        data-testid={inputId}
      />
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={() => inputRef.current?.click()}
        aria-describedby={`${descriptionId} ${limitId}`}
        disabled={disabled}
      >
        <Upload className="size-4" aria-hidden />
        {buttonLabel}
      </Button>
      <p id={limitId} className="mt-3 text-xs leading-relaxed text-zinc-500">
        {limitDescription}
      </p>
    </div>
  );
}
