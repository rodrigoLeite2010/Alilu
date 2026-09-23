import type { Metadata } from "next";
import { ViralPostStudio } from "@/components/instagram/ViralPostStudio";

export const metadata: Metadata = {
  title: "Posts Virais para Instagram",
  description: "Escolha um template, coloque a sua foto, edite os textos e publique ou agende no Instagram.",
  // Área de criação/publicação (depende de conta) — fora do índice por enquanto.
  robots: { index: false, follow: false },
};

interface PostsViraisPageProps {
  searchParams: Promise<{ editar?: string; status?: string; mensagem?: string }>;
}

/**
 * Posts Virais: criar publicação a partir de um template → personalizar →
 * inserir a própria imagem → prévia → publicar agora ou agendar. Pode ser
 * usado sem login; login e conexão com o Instagram só são pedidos ao
 * salvar/publicar (o rascunho local é preservado nos redirecionamentos).
 */
export default async function PostsViraisPage({ searchParams }: PostsViraisPageProps) {
  const { editar, status, mensagem } = await searchParams;
  const editId = typeof editar === "string" && /^[0-9a-f-]{36}$/i.test(editar) ? editar : null;
  const notice =
    status === "conectado"
      ? "Instagram conectado! Continue de onde parou."
      : status === "erro"
        ? (mensagem ?? "Não foi possível conectar o Instagram.")
        : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Posts Virais</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Escolha um template, adicione a sua imagem, ajuste o enquadramento e os textos, veja a prévia e publique agora ou
          agende — a publicação acontece automaticamente, mesmo com o Alilu fechado.
        </p>
      </div>
      <ViralPostStudio editId={editId} notice={notice} />
    </div>
  );
}
