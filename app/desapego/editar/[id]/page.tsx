import type {Metadata} from "next";
import {auth} from "@/auth";
import {notFound,redirect} from "next/navigation";
import {ownProduct,settings} from "@/lib/desapego/repository";
import {DesapegoForm} from "@/components/desapego/DesapegoForm";
import {DesapegoError,PRODUCT_ID} from "@/lib/desapego/model";
export const metadata:Metadata={title:"Editar anúncio | Alilu Desapego",robots:{index:false,follow:false}};
export default async function EditAdPage({params}:{params:Promise<{id:string}>}){const {id}=await params,user=(await auth())?.user?.id;if(!user)redirect(`/entrar?callbackUrl=${encodeURIComponent(`/desapego/editar/${id}`)}`);if(!PRODUCT_ID.test(id))notFound();let initial;try{initial=await ownProduct(user,id);}catch(error){if(error instanceof DesapegoError&&error.status===404)notFound();throw error;}return <><h1 className="mb-5 text-3xl font-bold">Editar anúncio</h1><DesapegoForm config={await settings()} initial={initial}/></>;}
