import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import { validateSettings, settings, saveProduct, ownProducts, ownProduct, transitionProduct, contactProduct, quota } from "@/lib/desapego/repository";
import { uploadProductImage, removeProductImage } from "@/lib/desapego/images";
import { DesapegoError } from "@/lib/desapego/model";
import { api, checkOrigin, identity, jsonBody, validProductId, visitorKey } from "@/lib/desapego/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

function pathParts(request:Request) { return new URL(request.url).pathname.replace(/^\/api\/desapego\/?/,"").split("/").filter(Boolean); }

export const GET=api(async(request)=>{
  const path=pathParts(request),user=(await auth())?.user?.id;
  if(path[0]==="meus-anuncios"){
    if(!user)throw new DesapegoError("Entre na sua conta.",401);
    return Response.json({items:await ownProducts(user)});
  }
  if(path.length===1){if(!user)throw new DesapegoError("Entre na sua conta.",401);return Response.json(await ownProduct(user,validProductId(path[0])));}
  if(path.length===0)return Response.json({settings:await settings()});
  throw new DesapegoError("Rota não encontrada.",404);
});

export const POST=api(async(request)=>{
  const path=pathParts(request),db=getDb();
  if(path.length===2&&["view","contact"].includes(path[1])){
    checkOrigin(request);
    const id=validProductId(path[0]),key=visitorKey(request,`ad:${id}`);
    await quota(`public:${key}`,60);
    const ad=await contactProduct(id);
    const event=await db`insert into desapego_rate_limits(key) values(${`${path[1]}:${id}:${key}`}) on conflict do nothing returning key`;
    if(event.length&&path[1]==="view")await db`update desapego_ads set views=views+1 where id=${id} and status='published'`;
    if(event.length&&path[1]==="contact")await db`update desapego_ads set contacts=contacts+1 where id=${id} and status='published'`;
    if(path[1]==="view")return Response.json({ok:true});
    const message=`Olá! Vi seu anúncio na Alilu Desapego e tenho interesse no produto ${ad.title}. Ainda está disponível? https://alilu.com.br/desapego/${ad.slug}`;
    return Response.json({url:`https://wa.me/${ad.phone}?text=${encodeURIComponent(message)}`});
  }
  if(path.length===2&&path[1]==="report"){
    checkOrigin(request);
    const adId=validProductId(path[0]),key=visitorKey(request,`report:${adId}`);
    await quota(`report:${key}`,5,3600);
    const body=await jsonBody(request),reason=typeof body.reason==="string"?body.reason.trim():"";
    if(reason.length<10||reason.length>1000)throw new DesapegoError("Descreva a denúncia em 10 a 1.000 caracteres.");
    await db`insert into desapego_reports(ad_id,report_key,reason) select id,${key},${reason} from desapego_ads where id=${adId} and status in ('published','sold') on conflict(report_key) do update set reason=excluded.reason,resolved=false`;
    return Response.json({ok:true});
  }
  const user=await identity(request);
  if(path.length===0){await quota(`create:${user}`,10,3600);return Response.json({id:await saveProduct(user,await jsonBody(request))},{status:201});}
  if(path[0]==="photos"&&path.length===1){await quota(`upload:${user}`,100,3600);return Response.json(await uploadProductImage(request,user),{status:201});}
  const id=validProductId(path[0]);
  if(path[1]==="status"){const body=await jsonBody(request);await transitionProduct(user,id,String(body.status));return Response.json({ok:true});}
  if(path[1]==="favorite"){
    const body=await jsonBody(request);
    if(body.saved===false)await db`delete from desapego_favorites where user_id=${user} and ad_id=${id}`;
    else await db`insert into desapego_favorites(user_id,ad_id) select ${user},id from desapego_ads where id=${id} and status='published' on conflict do nothing`;
    return Response.json({ok:true});
  }
  throw new DesapegoError("Rota não encontrada.",404);
});

export const PATCH=api(async(request)=>{
  const user=await identity(request),path=pathParts(request);
  if(path.length!==1)throw new DesapegoError("Rota não encontrada.",404);
  return Response.json({id:await saveProduct(user,await jsonBody(request),validProductId(path[0]))});
});

export const DELETE=api(async(request)=>{
  const user=await identity(request),path=pathParts(request);
  if(path[0]==="photos"&&path.length===2)await removeProductImage(user,validProductId(path[1]));
  else if(path.length===1)await transitionProduct(user,validProductId(path[0]),"removed");
  else throw new DesapegoError("Rota não encontrada.",404);
  return Response.json({ok:true});
});

export const PUT=api(async(request)=>{
  const user=await identity(request,true),path=pathParts(request),body=await jsonBody(request),db=getDb();
  if(path[0]==="settings"){
    const config=validateSettings(body);
    const used=await db`select distinct data->>'category' as name from desapego_ads where status<>'removed'`;
    const retained=new Set(config.categories.map(category=>category.name));
    const omitted=used.map(row=>String(row.name)).filter(name=>!retained.has(name));
    if(omitted.length)throw new DesapegoError(`Antes de remover estas categorias, resolva anúncios existentes: ${omitted.join(", ")}.`);
    await db`update desapego_settings set config=${JSON.stringify(config)}::jsonb where id=1`;
  }else if(path[0]==="suspend"){
    const target=validProductId(String(body.userId));
    await db`insert into desapego_advertisers(user_id,suspended) values(${target},${body.suspended===true}) on conflict(user_id) do update set suspended=excluded.suspended`;
  }else if(path[0]==="report"){
    await db`update desapego_reports set resolved=true where id=${validProductId(String(body.id))}`;
  }else{
    const id=validProductId(path[0]),reason=String(body.reason??"").trim().slice(0,500);
    if(!Number.isInteger(body.revision)||Number(body.revision)<1)throw new DesapegoError("Atualize o anúncio antes de moderar.");
    if(["rejected","removed"].includes(String(body.status))&&reason.length<3)throw new DesapegoError("Informe o motivo da moderação.");
    await transitionProduct(user,id,String(body.status),true,reason,Number(body.revision));
  }
  return Response.json({ok:true});
});
