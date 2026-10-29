"use client";
import { useState } from "react";
import type { FormEvent } from "react";
export function ProductReportForm({id}:{id:string}) {
  const [reason,setReason]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");try{const r=await fetch(`/api/desapego/${id}/report`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})});const data=await r.json();if(!r.ok)throw new Error(data.error??"Não foi possível enviar.");setMessage("Obrigado. A denúncia foi enviada para análise.");setReason("");}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
  return <form id="denunciar" onSubmit={submit} className="estate-panel mt-8 space-y-3"><h2 className="text-lg font-semibold">Denunciar anúncio</h2><p className="text-sm text-zinc-600">Informe se suspeita de fraude, produto proibido ou conteúdo enganoso. Não envie dados pessoais.</p><textarea required minLength={10} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Conte o motivo da denúncia"/><button disabled={busy} className="estate-button secondary">{busy?"Enviando…":"Enviar denúncia"}</button>{message?<p role="status" className="text-sm text-zinc-600">{message}</p>:null}</form>;
}
