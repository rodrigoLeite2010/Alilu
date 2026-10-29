import type {Metadata} from "next";
import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {ownProducts} from "@/lib/desapego/repository";
import {DesapegoOwnerPanel} from "@/components/desapego/DesapegoOwnerPanel";
export const metadata:Metadata={title:"Meus anúncios | Alilu Desapego",robots:{index:false,follow:false}};
export default async function MyAdsPage({searchParams}:{searchParams:Promise<{enviado?:string}>}){const user=(await auth())?.user?.id;if(!user)redirect("/entrar?callbackUrl=/desapego/meus-anuncios");const {enviado}=await searchParams;return <DesapegoOwnerPanel items={await ownProducts(user)} sent={enviado==="1"}/>;}
