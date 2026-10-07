export interface AdminLink {
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
    title: "Carrossel Inteligente",
    links: [
      {
        href: "/admin/carrossel",
        title: "Carrossel Inteligente",
        description: "Assinantes e MRR do produto, desconto de cliente Alilu, teste grátis, uso, custo de IA (tokens e buscas), receita líquida e margem.",
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
      {
        href: "/admin/stories-inteligentes",
        title: "Stories inteligentes",
        description: "Tipos gerados, uso do texto de reserva e últimos problemas.",
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

