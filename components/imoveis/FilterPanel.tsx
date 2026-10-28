"use client";
import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
export function FilterPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <aside>
      <button
        type="button"
        className="estate-button estate-filter-toggle secondary mb-4 w-full"
        aria-expanded={open}
        aria-controls="property-filters"
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={18} />
        {open ? "Ocultar filtros" : "Filtrar imóveis"}
      </button>
      <div id="property-filters" className={open ? "block" : "hidden lg:block"}>
        {children}
      </div>
    </aside>
  );
}
