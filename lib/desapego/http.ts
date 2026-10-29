import "server-only";
import { createHmac } from "node:crypto";
import { auth } from "@/auth";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getDb } from "@/lib/db/client";
import { DesapegoError, PRODUCT_ID } from "./model";
import { quota } from "./repository";

export function checkOrigin(request: Request) {
  const origin=request.headers.get("origin"),url=new URL(request.url),host=request.headers.get("host")??url.host;
  const protocol=request.headers.get("x-forwarded-proto")?.split(",")[0].trim()??url.protocol.slice(0,-1);
  let expected="";
  try { if(["http","https"].includes(protocol)) expected=new URL(`${protocol}://${host}`).origin; } catch { /* reject invalid host below */ }
  if(!origin||!expected||origin!==expected) throw new DesapegoError("Origem inválida.",403);
}

export async function identity(request:Request,admin=false) {
  checkOrigin(request);
  const user=admin?(await getAdminSession())?.userId:(await auth())?.user?.id;
  if(!user) throw new DesapegoError(admin?"Acesso restrito.":"Entre na sua conta.",admin?403:401);
  const [account]=await getDb()`select id from users where id=${user} and disabled_at is null`;
  if(!account) throw new DesapegoError("Conta indisponível.",403);
  await quota(`mutation:${user}`,60);
  return user;
}

export function validProductId(id:string) { if(!PRODUCT_ID.test(id)) throw new DesapegoError("Identificador inválido.",404); return id; }

export async function jsonBody(request:Request) {
  const max=64*1024,declared=Number(request.headers.get("content-length"));
  if(declared>max) throw new DesapegoError("Dados acima do limite.",413);
  const reader=request.body?.getReader(); if(!reader) throw new DesapegoError("Envie os dados.");
  const parts:Uint8Array[]=[]; let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new DesapegoError("Dados acima do limite.",413);}parts.push(value);}
  try {const parsed=JSON.parse(Buffer.concat(parts).toString("utf8"));if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error();return parsed as Record<string,unknown>;} catch {throw new DesapegoError("JSON inválido.");}
}

export async function boundedBody(request:Request,max:number) {
  if(Number(request.headers.get("content-length"))>max) throw new DesapegoError("Arquivo acima do limite.",413);
  const reader=request.body?.getReader();if(!reader)throw new DesapegoError("Envie o arquivo.");
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new DesapegoError("Arquivo acima do limite.",413);}chunks.push(value);}
  return Buffer.concat(chunks);
}

export function visitorKey(request:Request,scope:string) {
  const secret=process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if(!secret)throw new DesapegoError("Ação temporariamente indisponível.",503);
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"local";
  return createHmac("sha256",secret).update(`${new Date().toISOString().slice(0,10)}:${scope}:${ip}`).digest("hex");
}

export function api(handler:(request:Request)=>Promise<Response>) {
  return async(request:Request)=>{
    try{const response=await handler(request);response.headers.set("Cache-Control","no-store");return response;}
    catch(error){let message="Não foi possível concluir. Tente novamente.",status=500;
      if(error instanceof DesapegoError){message=error.message;status=error.status;}
      else if(error instanceof Error&&error.message.includes("desapego: ")){message=error.message.split("desapego: ")[1].split("\n")[0];status=409;}
      else if((error as {code?:string})?.code==="23505"){message="Este produto já foi cadastrado.";status=409;}
      else console.error("desapego_request_failed",{name:error instanceof Error?error.name:"unknown",code:(error as {code?:string})?.code});
      return Response.json({error:message},{status,headers:{"Cache-Control":"no-store"}});
    }
  };
}
