import { Icon } from "@/components/ui/Icon";

export type MobileStatus = "done" | "processing" | "error" | "scheduled" | "published" | "draft" | "review";

const config: Record<MobileStatus, { label: string; icon: string; classes: string }> = {
  done: { label: "Concluído", icon: "check", classes: "bg-emerald-50 text-emerald-800" },
  published: { label: "Publicado", icon: "check", classes: "bg-emerald-50 text-emerald-800" },
  processing: { label: "Processando", icon: "loader", classes: "bg-brand-primary-soft text-brand-primary" },
  scheduled: { label: "Agendado", icon: "clock", classes: "bg-brand-accent-soft text-brand-accent-dark" },
  error: { label: "Erro", icon: "circle-alert", classes: "bg-red-50 text-red-800" },
  draft: { label: "Rascunho", icon: "file-text", classes: "bg-zinc-100 text-zinc-700" },
  review: { label: "Revisar", icon: "circle-alert", classes: "bg-brand-accent-soft text-brand-accent-dark" },
};

/** Selo de status com ícone + texto: nunca depende só da cor. */
export function MobileStatusBadge({ status }: { status: MobileStatus }) {
  const { label, icon, classes } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
