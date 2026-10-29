"use client";
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { DESAPEGO_STATES, DELIVERY_OPTIONS, EMPTY_PRODUCT, MAX_PRODUCT_PHOTOS, PRODUCT_CONDITIONS, productMoney, type DesapegoSettings, type ProductAd, type ProductImage } from "@/lib/desapego/model";

type InitialProduct=(ProductAd&{phone?:string;zip?:string;consent?:boolean})|null;
export function DesapegoForm({config,initial=null}:{config:DesapegoSettings;initial?:InitialProduct}) {
  const router=useRouter();
  const [data,setData]=useState({...EMPTY_PRODUCT,...initial?.data,category:initial?.data.category??config.categories[0]?.name??""});
  const [phone,setPhone]=useState(initial?.phone??"");
  const [zip,setZip]=useState(initial?.zip??"");
  const [consent,setConsent]=useState(initial?.consent??false);
  const [photos,setPhotos]=useState<ProductImage[]>(initial?.images??[]);
  const [revision,setRevision]=useState(initial?.revision??0);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [progress,setProgress]=useState("");
  const currentCategory=config.categories.find(c=>c.name===data.category);
  const imageIds=useMemo(()=>photos.map(p=>p.id),[photos]);
  function change<K extends keyof typeof EMPTY_PRODUCT>(key:K,value:(typeof EMPTY_PRODUCT)[K]){setData(current=>({...current,[key]:value}));}
  async function upload(files:FileList|null){
    if(!files?.length)return;
    setMessage("");const selected=Array.from(files).slice(0,Math.max(0,Math.min(config.maxPhotos,MAX_PRODUCT_PHOTOS)-photos.length));
    if(!selected.length){setMessage(`Você já atingiu o limite de ${Math.min(config.maxPhotos,MAX_PRODUCT_PHOTOS)} fotos.`);return;}
    setUploading(true);
    try{
      for(let i=0;i<selected.length;i++){
        const file=selected[i];if(file.size>3*1024*1024)throw new Error(`${file.name}: o arquivo deve ter até 3 MB.`);
        if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error(`${file.name}: use JPG, PNG ou WebP.`);
        setProgress(`Processando foto ${i+1} de ${selected.length}…`);
        const response=await fetch(`/api/desapego/photos?name=${encodeURIComponent(file.name)}`,{method:"POST",headers:{"Content-Type":file.type},body:file});
        const result=await response.json();if(!response.ok)throw new Error(result.error??"Não foi possível enviar a foto.");
        setPhotos(current=>[...current,result as ProductImage]);
      }
    }catch(error){setMessage((error as Error).message);}finally{setProgress("");setUploading(false);}
  }
  function reorder(index:number,delta:number){setPhotos(current=>{const target=index+delta;if(target<0||target>=current.length)return current;const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;});}
  async function save(submit:boolean){
    setBusy(true);setMessage("");
    try{
      const body={...data,phone,zip,consent,submit,imageIds,revision};
      const response=await fetch(initial?`/api/desapego/${initial.id}`:"/api/desapego",{method:initial?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw new Error(result.error??"Não foi possível salvar o anúncio.");
      setRevision(current=>current+1);
      if(submit){router.push("/desapego/meus-anuncios?enviado=1");router.refresh();}
      else if(initial){setMessage("Rascunho salvo. Se o anúncio estava publicado, as alterações aguardam nova análise.");router.refresh();}
      else router.push(`/desapego/editar/${result.id}?rascunho=1`);
    }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}
  }
  return <form className="space-y-6" onSubmit={e=>{e.preventDefault();void save(true);}}>
    <section className="estate-panel space-y-4"><div><h2 className="text-xl font-semibold">Sobre o produto</h2><p className="mt-1 text-sm text-zinc-500">Anuncie somente produtos permitidos e que você tem direito de vender.</p></div>
      <label>Título do anúncio<input required minLength={8} maxLength={120} value={data.title} onChange={e=>change("title",e.target.value)} placeholder="Ex.: Bicicleta aro 29 em ótimo estado"/></label>
      <div className="grid gap-4 sm:grid-cols-2"><label>Categoria<select required value={data.category} onChange={e=>{change("category",e.target.value);change("subcategory","");}}>{config.categories.map(c=><option key={c.name}>{c.name}</option>)}</select></label><label>Subcategoria<select value={data.subcategory} onChange={e=>change("subcategory",e.target.value)}><option value="">Sem subcategoria</option>{currentCategory?.subcategories.map(s=><option key={s}>{s}</option>)}</select></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label>Marca (opcional)<input maxLength={80} value={data.brand} onChange={e=>change("brand",e.target.value)}/></label><label>Modelo (opcional)<input maxLength={80} value={data.model} onChange={e=>change("model",e.target.value)}/></label></div>
      <label>Descrição<textarea required minLength={30} maxLength={5000} rows={5} value={data.description} onChange={e=>change("description",e.target.value)} placeholder="Descreva o produto com informações verdadeiras sobre o estado, acessórios e funcionamento."/></label>
      <div className="grid gap-4 sm:grid-cols-2"><label>Tempo de uso (opcional)<input maxLength={80} value={data.usageTime} onChange={e=>change("usageTime",e.target.value)} placeholder="Ex.: 1 ano"/></label><label>Estado de conservação<select value={data.condition} onChange={e=>change("condition",e.target.value)}>{PRODUCT_CONDITIONS.map(c=><option key={c}>{c}</option>)}</select></label></div>
    </section>
    <section className="estate-panel space-y-4"><div><h2 className="text-xl font-semibold">Preço e localização</h2><p className="mt-1 text-sm text-zinc-500">O endereço residencial completo não será exibido.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><label>Preço atual (R$)<input required type="number" min="0.01" max="1000000000000" step="0.01" value={data.price||""} onChange={e=>change("price",Number(e.target.value)||0)}/></label><label>Valor anterior (opcional)<input type="number" min="0" max="1000000000000" step="0.01" value={data.previousPrice||""} onChange={e=>change("previousPrice",Number(e.target.value)||0)} aria-describedby="previous-price-note"/><span id="previous-price-note" className="text-xs text-zinc-500">Informe somente um preço anterior real.</span></label></div>
      <div className="flex flex-wrap gap-5"><label><input type="checkbox" checked={data.negotiable} onChange={e=>change("negotiable",e.target.checked)}/> Preço negociável</label><label><input type="checkbox" checked={data.acceptsExchange} onChange={e=>change("acceptsExchange",e.target.checked)}/> Aceita troca</label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label>Estado<select value={data.state} onChange={e=>change("state",e.target.value)}>{DESAPEGO_STATES.map(s=><option key={s}>{s}</option>)}</select></label><label>Cidade<input required minLength={2} maxLength={100} value={data.city} onChange={e=>change("city",e.target.value)}/></label><label>Bairro (opcional)<input maxLength={100} value={data.neighborhood} onChange={e=>change("neighborhood",e.target.value)}/></label><label>CEP (opcional, privado)<input inputMode="numeric" maxLength={9} value={zip} onChange={e=>setZip(e.target.value)}/></label></div>
      <label>Retirada ou entrega<select value={data.delivery} onChange={e=>change("delivery",e.target.value)}>{DELIVERY_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></label>
    </section>
    <section className="estate-panel space-y-4"><div><h2 className="text-xl font-semibold">Contato e fotos</h2><p className="mt-1 text-sm text-zinc-500">O WhatsApp será compartilhado somente quando a pessoa escolher conversar com você.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><label>Nome público<input required minLength={2} maxLength={80} value={data.sellerName} onChange={e=>change("sellerName",e.target.value)}/></label><label>WhatsApp com DDD<input required type="tel" maxLength={25} inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(11) 98765-4321"/></label></div>
      <div><label className="inline-flex items-center gap-2"><ImagePlus size={18}/> Fotos ({photos.length}/{Math.min(config.maxPhotos,MAX_PRODUCT_PHOTOS)})<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading||photos.length>=Math.min(config.maxPhotos,MAX_PRODUCT_PHOTOS)} onChange={e=>{void upload(e.target.files);e.currentTarget.value="";}}/></label><p className="mt-1 text-xs text-zinc-500">JPG, PNG ou WebP até 3 MB por arquivo. As imagens são redimensionadas, otimizadas e têm metadados removidos.</p></div>
      {progress?<p role="status" className="text-sm text-zinc-600">{progress}</p>:null}
      {photos.length?<ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo,index)=><li key={photo.id} className="relative overflow-hidden rounded-xl border border-zinc-200"><img src={photo.thumbnail} alt={`Foto ${index+1} do produto`} width={480} height={360} className="aspect-[4/3] w-full object-cover"/><div className="flex flex-wrap items-center justify-between gap-1 p-2"><span className="text-xs">{index===0?"Foto principal":`Foto ${index+1}`}</span><div className="flex gap-1"><button type="button" aria-label="Mover foto para cima" title="Mover para cima" disabled={index===0||uploading} className="rounded p-1 hover:bg-zinc-100" onClick={()=>reorder(index,-1)}><ArrowUp size={16}/></button><button type="button" aria-label="Mover foto para baixo" title="Mover para baixo" disabled={index===photos.length-1||uploading} className="rounded p-1 hover:bg-zinc-100" onClick={()=>reorder(index,1)}><ArrowDown size={16}/></button><button type="button" aria-label="Remover foto" title="Remover" disabled={uploading} className="rounded p-1 text-red-700 hover:bg-red-50" onClick={()=>setPhotos(current=>current.filter(p=>p.id!==photo.id))}><Trash2 size={16}/></button></div></div></li>)}</ol>:null}
      <label className="flex items-start gap-2 rounded-xl bg-zinc-50 p-4 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-0.5"/><span>Confirmo que tenho direito de vender este produto, que ele não é ilegal, falsificado ou roubado e que as informações e fotos são verdadeiras. Autorizo o uso do meu WhatsApp apenas para contato de interessados. Aceito os <a className="underline" href="/termos-de-uso" target="_blank">termos de uso</a> e a <a className="underline" href="/privacidade" target="_blank">política de privacidade</a>.</span></label>
    </section>
    <section className="estate-panel"><h2 className="text-xl font-semibold">Prévia do anúncio</h2><div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">{photos[0]?<img src={photos[0].thumbnail} alt="Foto principal na prévia" width={480} height={360} className="aspect-[4/3] w-full rounded-lg object-cover"/>:<div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-500">Adicione uma foto</div>}<div><p className="font-semibold">{data.title||"Título do produto"}</p><p className="mt-2 text-xl font-bold text-brand-primary">{productMoney(Number(data.price)||0)}</p><p className="mt-1 text-sm text-zinc-500">{data.city||"Cidade"} / {data.state} · {data.condition}</p><p className="mt-2 text-sm text-zinc-600">{data.description||"A descrição do produto aparecerá aqui."}</p></div></div></section>
    {message?<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{message}</p>:null}
    <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={busy||uploading} className="text-sm text-brand-primary underline" onClick={()=>void save(false)}>{busy?"Salvando…":"Salvar rascunho"}</button><button type="submit" disabled={busy||uploading||!consent} className="estate-button">{busy?"Enviando…":initial?"Enviar para nova análise":"Enviar para análise"}</button></div>
  </form>;
}
