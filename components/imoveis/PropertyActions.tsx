/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { Heart, Share2, Copy, MessageCircle, Flag, X } from "lucide-react";
import type { PropertyImage } from "@/lib/imoveis/model";
import { estateRequest } from "./client";
export function PropertyGallery({
  images,
  title,
}: {
  images: PropertyImage[];
  title: string;
}) {
  const [active, setActive] = useState(0),
    dialog = useRef<HTMLDialogElement>(null);
  return (
    <div>
      <button
        type="button"
        className="block w-full overflow-hidden rounded-2xl bg-brand-primary-soft"
        aria-label="Ampliar foto do imóvel"
        onClick={() => dialog.current?.showModal()}
      >
        {images[active] && (
          <img
            src={images[active].url}
            alt={`${title} — foto ${active + 1}`}
            width={1600}
            height={1000}
            fetchPriority="high"
            className="aspect-[16/10] w-full object-cover"
          />
        )}
      </button>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {images.map((i, index) => (
          <button
            key={i.id}
            type="button"
            aria-label={`Ver foto ${index + 1}`}
            aria-pressed={active === index}
            onClick={() => setActive(index)}
            className={`shrink-0 overflow-hidden rounded-lg border-2 ${active === index ? "border-brand-accent" : "border-transparent"}`}
          >
            <img
              src={i.thumbnail}
              width={120}
              height={90}
              loading="lazy"
              alt={`Miniatura ${index + 1}`}
              className="h-20 w-28 object-cover"
            />
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="fixed inset-0 m-auto max-h-[95dvh] w-[95vw] max-w-6xl rounded-2xl bg-zinc-950 p-4 text-white backdrop:bg-black/80"
      >
        <div className="mb-3 flex items-center justify-between">
          <p>
            Foto {active + 1} de {images.length}
          </p>
          <button
            type="button"
            aria-label="Fechar galeria"
            onClick={() => dialog.current?.close()}
            className="p-3"
          >
            <X />
          </button>
        </div>
        {images[active] && (
          <img
            src={images[active].url}
            width={1600}
            height={1000}
            alt={title}
            className="max-h-[70dvh] w-full object-contain"
          />
        )}
        <div className="mt-3 flex justify-between">
          <button
            type="button"
            className="p-3"
            onClick={() =>
              setActive((active + images.length - 1) % images.length)
            }
          >
            ← Anterior
          </button>
          <button
            type="button"
            className="p-3"
            onClick={() => setActive((active + 1) % images.length)}
          >
            Próxima →
          </button>
        </div>
      </dialog>
    </div>
  );
}
export function PropertyActions({
  id,
  url,
  available,
  saved: initialSaved = false,
}: {
  id: string;
  url: string;
  available: boolean;
  saved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("");
  const viewed = useRef(false);
  useEffect(() => {
    if (available && !viewed.current) {
      viewed.current = true;
      void estateRequest(`/${id}/view`).catch(() => {});
    }
  }, [id, available]);
  async function action(type: string) {
    setBusy(true);
    setMessage("");
    try {
      if (type === "contact") {
        const result = await estateRequest(`/${id}/contact`);
        window.location.assign(result.url);
      }
      if (type === "favorite") {
        await estateRequest(`/${id}/favorite`, "POST", { saved: !saved });
        setSaved(!saved);
        setMessage(
          saved ? "Removido dos favoritos." : "Imóvel salvo nos favoritos.",
        );
      }
      if (type === "copy") {
        await navigator.clipboard.writeText(url);
        setMessage("Link copiado!");
      }
      if (type === "share") {
        if (navigator.share)
          await navigator.share({ title: "Imóvel na Alilu", url });
        else {
          await navigator.clipboard.writeText(url);
          setMessage("Link copiado para compartilhar.");
        }
      }
      if (type === "report") {
        await estateRequest(`/${id}/report`, "POST", { reason });
        setReport(false);
        setMessage("Denúncia recebida. A equipe fará a análise.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {available && (
        <button
          type="button"
          disabled={busy}
          className="estate-button w-full"
          onClick={() => void action("contact")}
        >
          <MessageCircle size={18} /> Conversar pelo WhatsApp
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={busy}
          className="estate-button secondary"
          onClick={() => void action("favorite")}
          aria-pressed={saved}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
          {saved ? "Salvo" : "Favoritar"}
        </button>
        <button
          disabled={busy}
          className="estate-button secondary"
          onClick={() => void action("copy")}
        >
          <Copy size={16} />
          Copiar link
        </button>
        <button
          disabled={busy}
          className="estate-button secondary"
          onClick={() => void action("share")}
        >
          <Share2 size={16} />
          Compartilhar
        </button>
        <a
          className="estate-button secondary"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(`Veja este imóvel na Alilu: ${url}`)}`}
        >
          WhatsApp
        </a>
      </div>
      <button
        className="flex items-center gap-2 py-2 text-xs text-zinc-500 underline"
        onClick={() => setReport(!report)}
      >
        <Flag size={13} />
        Denunciar anúncio
      </button>
      {report && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action("report");
          }}
          className="space-y-3"
        >
          <label>
            O que aconteceu?
            <textarea
              rows={3}
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="estate-button secondary" disabled={busy}>
            Enviar denúncia
          </button>
        </form>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-brand-accent-soft p-3 text-sm"
        >
          {message}
          {message === "Entre na sua conta." && (
            <a
              href={`/entrar?callbackUrl=${encodeURIComponent(new URL(url).pathname)}`}
              className="ml-2 underline"
            >
              Entrar
            </a>
          )}
        </p>
      )}
    </div>
  );
}
