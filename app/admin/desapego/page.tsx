import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {Container} from "@/components/ui/Container";
import {getAdminSession} from "@/lib/admin/admin-access";
import {adminProducts} from "@/lib/desapego/repository";
import {AdminPanel} from "@/components/desapego/AdminPanel";
import "@/app/imoveis/imoveis.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Admin — Desapego",robots:{index:false,follow:false}};
export default async function DesapegoAdminPage({searchParams}:{searchParams:Promise<{page?:string}>}){if(!(await getAdminSession()))notFound();const raw=Number((await searchParams).page),page=Number.isFinite(raw)?Math.min(1000,Math.max(1,Math.floor(raw)||1)):1;return <Container className="property-portal max-w-6xl py-10"><AdminPanel {...(await adminProducts(page) as unknown as Parameters<typeof AdminPanel>[0])} page={page}/></Container>;}
