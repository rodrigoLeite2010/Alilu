import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {settings} from "@/lib/desapego/repository";
import {DesapegoForm} from "@/components/desapego/DesapegoForm";
export const metadata:Metadata={title:"Anunciar grátis no Desapego | Alilu",robots:{index:false,follow:false}};
export default async function NewAdPage(){if(!(await auth())?.user?.id)redirect("/entrar?callbackUrl=/desapego/anunciar");return <><h1 className="mb-2 text-3xl font-bold">Anuncie no Desapego</h1><p className="mb-6 text-zinc-600">Anúncio gratuito. Após uma análise, ele aparece publicamente e os interessados conversam direto com você.</p><DesapegoForm config={await settings()}/></>;}
