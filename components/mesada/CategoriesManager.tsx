"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { CategoryDto } from "@/lib/allowance/types";
import { call } from "./api";
import { QuickForm } from "./QuickForm";

export function CategoriesManager({ categories }: { categories: CategoryDto[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    const result = await call("PATCH", `/api/allowance/categories/${id}`, body);
    setError(result.error ?? null);
    router.refresh();
  }

  const groups: Array<{ type: "EXPENSE" | "INCOME"; title: string }> = [
    { type: "EXPENSE", title: "Categorias de gasto" },
    { type: "INCOME", title: "Categorias de entrada" },
  ];

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {groups.map((group) => (
        <section key={group.type} className="rounded-xl border border-zinc-200 p-4">
          <h2 className="text-base font-semibold text-zinc-900">{group.title}</h2>
          <ul className="mt-2 divide-y divide-zinc-100">
            {categories
              .filter((c) => c.type === group.type)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <span className={`text-sm ${c.active ? "text-zinc-900" : "text-zinc-400 line-through"}`}>
                    {c.icon} {c.name} {c.isSystem ? <span className="text-xs text-zinc-400">(padrão)</span> : null}
                  </span>
                  {!c.isSystem ? (
                    <Button type="button" variant="ghost" onClick={() => patch(c.id, { active: !c.active })}>
                      {c.active ? "Desativar" : "Reativar"}
                    </Button>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
      <Button type="button" onClick={() => setAdding(true)} className="w-full sm:w-auto">
        Nova categoria
      </Button>
      <QuickForm
        open={adding}
        title="Nova categoria"
        submitLabel="Criar"
        onClose={() => setAdding(false)}
        fields={[
          { name: "name", label: "Nome", type: "text", required: true, maxLength: 40 },
          { name: "type", label: "Tipo", type: "select", defaultValue: "EXPENSE", options: [{ value: "EXPENSE", label: "Gasto" }, { value: "INCOME", label: "Entrada" }] },
          { name: "icon", label: "Ícone (emoji)", type: "text", defaultValue: "🏷️", maxLength: 8 },
        ]}
        onSubmit={async (values) => {
          const result = await call("POST", "/api/allowance/categories", values);
          if (result.error) return result.error;
          router.refresh();
          return null;
        }}
      />
    </div>
  );
}
