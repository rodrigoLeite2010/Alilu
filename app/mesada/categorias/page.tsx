import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { CategoriesManager } from "@/components/mesada/CategoriesManager";
import { listUserCategories } from "@/lib/allowance/backend/allowance-service";
import { MesadaLoginGate } from "../_login-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categorias da Mesada | Alilu", robots: { index: false, follow: false } };

export default async function CategoriesPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) return <MesadaLoginGate returnPath="/mesada/categorias" />;
  const categories = await listUserCategories(userId, true);
  return (
    <Container className="max-w-3xl py-6 sm:py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/mesada" className="hover:underline">
          Mesada
        </Link>{" "}
        › Categorias
      </p>
      <h1 className="mt-1 mb-5 text-2xl font-bold text-zinc-900">Categorias</h1>
      <CategoriesManager categories={categories} />
    </Container>
  );
}
