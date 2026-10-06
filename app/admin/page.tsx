import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

interface AdminLink {
  href: string;
  title: string;
  description: string;
}

/** Todas as telas de administração do site. Ao criar uma nova página em /admin, inclua-a aqui. */
export const ADMIN_SECTIONS: { title: string; links: AdminLink[] }[] = [
  {
    title: "Clientes e assinaturas",
    links: [
      {
        href: "/admin/assinaturas/usuarios",
        title: "Usuários e planos",
        description: "Quem logou, plano e situação de pagamento. Abra um cliente para dar créditos, conceder cortesia, encerrar plano, estender teste ou desativar a conta.",
      },
      {
        href: "/admin/assinaturas",
        title: "Assinaturas e receita",
        description: "MRR, atrasos, churn, uso da franquia de IA, créditos vendidos, custo de IA e margem por plano.",
      },
    ],
  },
  {
    title: "Créditos e IA",
    links: [
      {
        href: "/admin/ia/precificacao",
        title: "Valores dos créditos e preços de IA",
        description: "Pacotes de créditos, preço do crédito, modelos de vídeo, provedores e margem configurada.",
      },
      {
        href: "/admin/ia/custos",
        title: "Custos de geração de IA",
        description: "Custo real das gerações de vídeo, receita em créditos e margem do mês.",
      },
    ],
  },
  {
    title: "Instagram",
    links: [
      {
        href: "/admin/instagram",
        title: "Instagram / Meta — Diagnóstico",
        description: "Estado da integração com a Meta, contas conectadas e verificações.",
      },
      {
        href: "/admin/instagram-import",
        title: "Importar do Instagram",
        description: "Cota e uso do importador de publicações.",
      },
    ],
  },
  {
    title: "Infraestrutura",
    links: [
      {
        href: "/admin/emails",
        title: "E-mails (Resend)",
        description: "Envios, falhas e configuração dos e-mails do site.",
      },
      {
        href: "/admin/armazenamento",
        title: "Armazenamento (Vercel Blob)",
        description: "Uso do armazenamento e limpeza automática de arquivos antigos.",
      },
    ],
  },
];

/** Admin — página inicial com atalhos para todas as áreas. Só ADMIN_EMAILS (qualquer outro usuário recebe 404). */
export default async function AdminHomePage() {
  const admin = await getAdminSession();
  if (!admin) notFound();

  return (
    <Container className="max-w-5xl py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
      <p className="mt-1 text-sm text-zinc-500">Área restrita aos administradores ({admin.email}). Aqui ficam todas as telas de gestão do site.</p>

      <div className="mt-6 space-y-8">
        {ADMIN_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{section.title}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block h-full rounded-lg border border-zinc-200 p-4 transition-colors hover:border-teal-700 hover:bg-teal-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <span className="block text-base font-semibold text-zinc-900">{link.title}</span>
                    <span className="mt-1 block text-sm text-zinc-600">{link.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Container>
  );
}
