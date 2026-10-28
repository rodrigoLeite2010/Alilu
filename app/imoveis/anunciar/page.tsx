import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PropertyForm } from "@/components/imoveis/PropertyForm";
import { settings } from "@/lib/imoveis/repository";
export const metadata = {
  title: "Anunciar imóvel gratuitamente",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await auth())?.user?.id)
    redirect("/entrar?callbackUrl=/imoveis/anunciar");
  return <PropertyForm config={await settings()} />;
}
