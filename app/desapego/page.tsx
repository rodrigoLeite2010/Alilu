import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { settings } from "@/lib/desapego/repository";
import { DesapegoSearch } from "@/components/desapego/DesapegoSearch";

export const dynamic="force-dynamic";
const listingMetadata:Metadata=buildPageMetadata({title:"Desapego: compre e venda produtos usados perto de você",description:"Anuncie grátis ou encontre produtos usados na Alilu Desapego. Pesquise por categoria, preço e localização e converse diretamente com quem anuncia.",path:"/desapego"});
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
function toParams(values:Record<string,string|string[]|undefined>){const p=new URLSearchParams();for(const [k,v] of Object.entries(values))for(const item of Array.isArray(v)?v:v?[v]:[])p.append(k,item);return p;}
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
  const params=toParams(await searchParams),filtered=[...params.keys()].some(k=>k!=="page");
  if(!filtered)return listingMetadata;
  return {...listingMetadata,robots:{index:false,follow:true},alternates:{canonical:"https://alilu.com.br/desapego"}};
}
export default async function DesapegoPage({searchParams}:Props){return <><nav className="mb-4 text-sm text-zinc-500"><Link href="/" className="hover:underline">Início</Link> › Desapego</nav><DesapegoSearch params={toParams(await searchParams)} config={await settings()}/></>;}
