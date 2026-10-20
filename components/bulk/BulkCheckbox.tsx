"use client";

import { useEffect, useRef } from "react";

/** Checkbox com área de toque de 44px (celular) e suporte a estado "parcial". */
export function BulkCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center ${disabled ? "opacity-50" : ""} ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="h-5 w-5 cursor-pointer rounded border-zinc-400 accent-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      />
    </label>
  );
}
