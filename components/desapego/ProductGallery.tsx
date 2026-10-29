"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { ProductImage } from "@/lib/desapego/model";
export function ProductGallery({images,title}:{images:ProductImage[];title:string}){
  const [active,setActive]=useState(0),photo=images[active];
  return <div><div className="overflow-hidden rounded-2xl bg-zinc-100">{photo?<img src={photo.url} alt={title} width={1600} height={1200} fetchPriority="high" className="aspect-[4/3] w-full object-contain"/>:<div className="flex aspect-[4/3] items-center justify-center text-zinc-500">Sem foto</div>}</div>{images.length>1?<div className="mt-3 flex gap-2 overflow-x-auto pb-1">{images.map((image,index)=><button type="button" key={image.id} aria-label={`Mostrar foto ${index+1}`} aria-pressed={active===index} onClick={()=>setActive(index)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${active===index?"border-brand-primary":"border-transparent"}`}><img src={image.thumbnail} alt="" width={120} height={90} loading="lazy" className="h-20 w-28 object-cover"/></button>)}</div>:null}</div>;
}
