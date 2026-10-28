import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PropertySearch } from "@/components/imoveis/PropertySearch";
import { settings } from "@/lib/imoveis/repository";
import { toParams } from "@/lib/imoveis/model";
export const metadata = {
  title: "Meus imóveis favoritos",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = (await auth())?.user?.id;
  if (!user) redirect("/entrar?callbackUrl=/imoveis/favoritos");
  return (
    <PropertySearch
      params={toParams(await searchParams)}
      config={await settings()}
      favoriteUser={user}
    />
  );
}
