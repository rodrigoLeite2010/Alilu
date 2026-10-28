import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { PropertyForm } from "@/components/imoveis/PropertyForm";
import { ownProperty, settings } from "@/lib/imoveis/repository";
import { UUID, PropertyError } from "@/lib/imoveis/model";
export const metadata = {
  title: "Editar imóvel",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    user = (await auth())?.user?.id;
  if (!user)
    redirect(
      `/entrar?callbackUrl=${encodeURIComponent(`/imoveis/editar/${id}`)}`,
    );
  if (!UUID.test(id)) notFound();
  let initial;
  try {
    initial = await ownProperty(user, id);
  } catch (error) {
    if (error instanceof PropertyError && error.status === 404) notFound();
    throw error;
  }
  return <PropertyForm config={await settings()} initial={initial} />;
}
