"use client";
import { useState } from "react";
import { Heart, Share2, MessageCircle, Flag, Copy } from "lucide-react";

export function ProductActions({id,slug,title,loggedIn,initialFavorite=false}:{id:string;slug:string;title:string;loggedIn:boolean;initialFavorite?:boolean}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[contactUrl,setContactUrl]=useState("");
  const [favorited,setFavorited]=useState(initialFavorite);
  const shareUrl=typeof window!=="undefined"?`${window.location.origin}/desapego/${slug}`:"";
  async function contact(){setBusy(true);setMessage("");setContactUrl("");const popup=window.open("about:blank","_blank");if(popup)popup.opener=null;try{const response=await fetch(`/api/desapego/${id}/contact`,{method:"POST"});const result=await response.json();if(!response.ok)throw new Error(result.error??"Contato indisponível.");if(popup)popup.location.href=result.url;else{setContactUrl(result.url);setMessage("Seu navegador bloqueou a nova janela. Use o link para abrir o WhatsApp.");}}catch(e){popup?.close();setMessage((e as Error).message);}finally{setBusy(false);}}
  async function favorite(){if(!loggedIn){setMessage("Entre na sua conta para salvar favoritos.");return;}setBusy(true);try{const response=await fetch(`/api/desapego/${id}/favorite`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({saved:!favorited})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Não foi possível atualizar favoritos.");setFavorited(!favorited);setMessage(favorited?"Produto removido dos favoritos.":"Produto salvo nos seus favoritos.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function share(){try{if(navigator.share)await navigator.share({title,text:`Veja este produto na Alilu Desapego: ${title}`,url:shareUrl});else{await navigator.clipboard.writeText(shareUrl);setMessage("Link copiado.");}}catch(e){if((e as Error).name!=="AbortError")setMessage("Não foi possível compartilhar.");}}
  async function copy(){try{await navigator.clipboard.writeText(shareUrl);setMessage("Link copiado.");}catch{setMessage("Não foi possível copiar o link.");}}
  return <div className="space-y-3">
    <button type="button" disabled={busy} className="estate-button w-full" onClick={()=>void contact()}><MessageCircle size={18}/>{busy?"Abrindo WhatsApp…":"Tenho interesse · WhatsApp"}</button>
    <div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy} aria-pressed={favorited} className="estate-button secondary" onClick={()=>void favorite()}><Heart size={16}/>{favorited?"Favoritado":"Favoritar"}</button><button type="button" className="estate-button secondary" onClick={()=>void share()}><Share2 size={16}/>Compartilhar</button><button type="button" className="estate-button secondary" onClick={()=>void copy()}><Copy size={16}/>Copiar link</button><a className="estate-button secondary" href="#denunciar"><Flag size={16}/>Denunciar</a></div>
    {message?<p role="status" className="text-sm text-zinc-600">{message}</p>:null}
    {contactUrl?<a className="estate-button w-full" href={contactUrl} target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp</a>:null}
  </div>;
}

