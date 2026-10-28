/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { publicProperty } from "@/lib/imoveis/repository";
import { money } from "@/lib/imoveis/model";
import { sharePhoto } from "@/lib/imoveis/images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Imóvel na Alilu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = await publicProperty((await params).slug);
  if (!p) return new Response(null, { status: 404 });
  const cover = p.images[0] ? await sharePhoto(p.images[0].url) : null;
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#004b5a",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            width={600}
            height={630}
            style={{ objectFit: "cover" }}
          />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 50,
            justifyContent: "center",
            width: 600,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 30, color: "#ff9f2a" }}>
            {`ALILU IMÓVEIS · ${p.data.purpose}`}
          </div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>{p.data.title}</div>
          <div style={{ fontSize: 24, marginTop: 24 }}>
            {`${p.data.city} / ${p.data.state}`}
          </div>
          <div style={{ fontSize: 46, marginTop: 35, fontWeight: 700 }}>
            {money(p.data.price)}
          </div>
          {p.data.advertiserType !== "Proprietário" && (
            <div style={{ fontSize: 18, marginTop: 20 }}>
              {`${p.data.advertiser} · CRECI ${p.data.creci}`}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "no-store" } },
  );
}
