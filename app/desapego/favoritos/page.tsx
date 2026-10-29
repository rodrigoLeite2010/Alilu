import type {Metadata} from "next";
import Link from "next/link";
import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {searchProducts} from "@/lib/desapego/repository";
import {ProductCard} from "@/components/desapego/ProductCard";
export const metadata:Metadata={title:"Favoritos | Alilu Desapego",robots:{index:false,follow:false}};
export default async function FavoritesPage(){const user=(await auth())?.user?.id;if(!user)redirect("/entrar?callbackUrl=/desapego/favoritos");const {items}=await searchProducts(new URLSearchParams(),user);return <><nav className="mb-4 text-sm text-zinc-500"><Link href="/desapego">← Desapego</Link></nav><h1 className="mb-5 text-3xl font-bold">Meus favoritos</h1>{items.length?<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(ad=><ProductCard key={ad.id} ad={ad}/>)}</div>:<div className="estate-panel py-12 text-center"><p className="text-lg">Você ainda não salvou produtos.</p><Link className="estate-button mt-4" href="/desapego">Explorar anúncios</Link></div>}</>;}
