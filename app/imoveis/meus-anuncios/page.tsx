import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ownProperties } from "@/lib/imoveis/repository";
import { OwnerPanel } from "@/components/imoveis/OwnerPanel";
export const metadata = {
  title: "Meus anúncios de imóveis",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = (await auth())?.user?.id;
  if (!user) redirect("/entrar?callbackUrl=/imoveis/meus-anuncios");
  return <OwnerPanel items={await ownProperties(user)} />;
}
