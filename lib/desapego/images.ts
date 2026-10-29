import "server-only";
import { randomUUID } from "node:crypto";
import { put, del, list } from "@vercel/blob";
import { getDb } from "@/lib/db/client";
import { processImage } from "@/lib/imoveis/images";
import { DesapegoError } from "./model";
import { boundedBody } from "./http";

export async function uploadProductImage(request:Request,user:string) {
  const extension=(new URL(request.url).searchParams.get("name")??"").split(".").pop()?.toLowerCase()??"";
  const buffer=await boundedBody(request,3*1024*1024);
  let image:{full:Buffer;thumb:Buffer};
  try { image=await processImage(buffer,extension,request.headers.get("content-type")??""); }
  catch(error){if(error instanceof Error)throw new DesapegoError(error.message);throw error;}
  const db=getDb(),id=randomUUID();
  const [reserved]=await db`select desapego_reserve_image(${user}::uuid,${id}::uuid) as ok`;
  if(!reserved?.ok)throw new DesapegoError("Limite de armazenamento ou de fotos atingido.",409);
  const paths=[`desapego/${user}/${id}.webp`,`desapego/${user}/${id}-thumb.webp`];
  try{
    const full=await put(paths[0],image.full,{access:"public",contentType:"image/webp",addRandomSuffix:false,cacheControlMaxAge:31536000});
    const thumb=await put(paths[1],image.thumb,{access:"public",contentType:"image/webp",addRandomSuffix:false,cacheControlMaxAge:31536000});
    await db`update desapego_images set url=${full.url},thumbnail=${thumb.url},bytes=${image.full.length+image.thumb.length} where id=${id}`;
    return {id,url:full.url,thumbnail:thumb.url};
  }catch(error){await db`update desapego_images set delete_pending=true where id=${id}`;throw error;}
}

export async function removeProductImage(user:string,id:string) {
  const rows=await getDb()`update desapego_images set delete_pending=true where id=${id} and user_id=${user} and ad_id is null returning id`;
  if(!rows.length)throw new DesapegoError("Foto não encontrada ou já vinculada a um anúncio.",404);
}

export async function cleanupProductImages() {
  const db=getDb();
  await db`with expired as (
    update desapego_ads set status='paused',reason='Prazo de 90 dias encerrado. Confirme a disponibilidade e reative para análise.',revision=revision+1,updated_at=now()
    where status='published' and expires_at<=now() returning id,user_id,data
  ) insert into desapego_history(ad_id,actor_id,action,snapshot)
    select id,user_id,'expired',jsonb_build_object('data',data,'reason','Prazo de 90 dias encerrado.') from expired`;
  await db`update desapego_images set delete_pending=true where ad_id is null and created_at<now()-interval '24 hours'`;
  const rows=await db`select id,user_id,url,thumbnail from desapego_images where delete_pending and ad_id is null limit 100`;
  let deleted=0;
  for(const row of rows){await del([`desapego/${row.user_id}/${row.id}.webp`,`desapego/${row.user_id}/${row.id}-thumb.webp`]);await db`delete from desapego_images where id=${row.id} and delete_pending and ad_id is null`;deleted++;}
  const [cursorRow]=await db`select key from desapego_rate_limits where key like 'cleanup-cursor:%' limit 1`;
  const cursor=cursorRow?String(cursorRow.key).slice(15):undefined;
  const batch=await list({prefix:"desapego/",limit:100,cursor});
  for(const blob of batch.blobs){
    if(new Date(blob.uploadedAt).getTime()>Date.now()-86400000)continue;
    const id=blob.pathname.split("/").pop()?.replace(/-thumb\.webp$|\.webp$/g,"");
    const [ref]=await db`select id from desapego_images where id::text=${id??""} and not delete_pending`;
    if(!ref)await del(blob.url);
  }
  await db`delete from desapego_rate_limits where key like 'cleanup-cursor:%' or window_start<now()-interval '2 days'`;
  if(batch.hasMore&&batch.cursor)await db`insert into desapego_rate_limits(key) values(${`cleanup-cursor:${batch.cursor}`}) on conflict do nothing`;
  return {deleted,scanned:batch.blobs.length};
}
