/* eslint-disable @next/next/no-img-element */
"use client";
import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ArrowLeft, ArrowRight } from "lucide-react";
import {
  EMPTY_PROPERTY,
  PURPOSES,
  STATES,
  type PropertyData,
  type Property,
  type PropertyImage,
  type Settings,
} from "@/lib/imoveis/model";
import { estateRequest } from "./client";
import {
  formatPropertyAmount,
  parsePropertyAmount,
} from "@/lib/imoveis/currency";
type AmountKey = "price" | "condo" | "iptu" | "fees";
const amountLabels: Record<AmountKey, string> = {
  price: "preço do imóvel",
  condo: "condomínio",
  iptu: "IPTU",
  fees: "outras taxas",
};
type Initial = Property & {
  phone: string;
  address: string;
  zip: string;
  consent: boolean;
};
const steps = [
  "O imóvel",
  "Localização",
  "Características",
  "Valores e contato",
  "Fotos e revisão",
];
async function compress(file: File) {
  if (
    !/\.(jpe?g|png|webp)$/i.test(file.name) ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw new Error("Selecione fotos JPEG, PNG ou WebP de até 15 MB.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 40_000_000) {
    bitmap.close();
    throw new Error("Use imagens de até 40 megapixels.");
  }
  const canvas = document.createElement("canvas"),
    scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Não foi possível preparar a imagem.")),
      "image/webp",
      0.82,
    ),
  );
  return new File([blob], "foto.webp", { type: "image/webp" });
}
export function PropertyForm({
  config,
  initial,
}: {
  config: Settings;
  initial?: Initial;
}) {
  const [data, setData] = useState<PropertyData>(
    initial?.data
      ? { ...EMPTY_PROPERTY, ...initial.data }
      : { ...EMPTY_PROPERTY },
  );
  const [amounts, setAmounts] = useState<Record<AmountKey, string>>(() => ({
    price: initial?.data.price ? formatPropertyAmount(initial.data.price) : "",
    condo: initial?.data.condo ? formatPropertyAmount(initial.data.condo) : "",
    iptu: initial?.data.iptu ? formatPropertyAmount(initial.data.iptu) : "",
    fees: initial?.data.fees ? formatPropertyAmount(initial.data.fees) : "",
  }));
  const [phone, setPhone] = useState(initial?.phone ?? ""),
    [address, setAddress] = useState(initial?.address ?? ""),
    [zip, setZip] = useState(initial?.zip ?? "");
  const [consent, setConsent] = useState(initial?.consent ?? false),
    [images, setImages] = useState<PropertyImage[]>(initial?.images ?? []);
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null),
    uploadLock = useRef(false);
  const update = <K extends keyof PropertyData>(
    key: K,
    value: PropertyData[K],
  ) => setData((d) => ({ ...d, [key]: value }));
  const text = (key: keyof PropertyData, label: string, required = true) => (
    <label>
      {label}
      <input
        value={String(data[key])}
        required={required}
        maxLength={key === "title" ? 120 : key === "watermarkName" ? 80 : 100}
        onChange={(e) => update(key, e.target.value as never)}
      />
    </label>
  );
  const number = (key: keyof PropertyData, label: string, required = false) => (
    <label>
      {label}
      <input
        type="number"
        min={required ? 0.01 : 0}
        max={1e12}
        step={
          ["bedrooms", "suites", "bathrooms", "parking"].includes(key)
            ? 1
            : "any"
        }
        value={Number(data[key]) || ""}
        required={required}
        onChange={(e) => update(key, Number(e.target.value) as never)}
      />
    </label>
  );
  const currency = (key: AmountKey, label: string, required = false) => (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        maxLength={24}
        required={required}
        value={amounts[key]}
        onChange={(e) => {
          const value = e.target.value;
          e.target.setCustomValidity(
            parsePropertyAmount(value) === null
              ? "Informe um valor como 2.659.574,47, com no máximo duas casas decimais."
              : "",
          );
          setAmounts((current) => ({ ...current, [key]: value }));
        }}
        onBlur={(e) => {
          const parsed = parsePropertyAmount(e.target.value);
          if (parsed !== null && e.target.value.trim())
            setAmounts((current) => ({
              ...current,
              [key]: formatPropertyAmount(parsed),
            }));
        }}
      />
    </label>
  );
  const select = (
    key: keyof PropertyData,
    label: string,
    options: readonly string[],
  ) => (
    <label>
      {label}
      <select
        value={String(data[key])}
        onChange={(e) => update(key, e.target.value as never)}
      >
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  async function upload(files: FileList | File[]) {
    if (uploadLock.current) return;
    if (images.length + files.length > config.maxPhotos) {
      setMessage(`Adicione no máximo ${config.maxPhotos} fotos.`);
      return;
    }
    uploadLock.current = true;
    setUploading(true);
    setMessage("");
    try {
      for (const file of Array.from(files)) {
        const prepared = await compress(file);
        const watermark = encodeURIComponent(data.watermarkName.trim());
        const creci = encodeURIComponent(data.creci.trim());
        const response = await fetch(
          `/api/imoveis/photos?name=foto.webp&watermark=${watermark}&creci=${creci}`,
          {
            method: "POST",
            headers: { "Content-Type": prepared.type },
            body: prepared,
          },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setImages((current) => [...current, result]);
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }
  async function remove(image: PropertyImage) {
    setImages((current) => current.filter((i) => i.id !== image.id));
    // Existing images are detached by the atomic property save. New, unattached uploads can be reclaimed now.
    if (!initial?.images.some((i) => i.id === image.id))
      try {
        await estateRequest(`/photos/${image.id}`, "DELETE");
      } catch {
        setMessage("A foto será removida automaticamente da área temporária.");
      }
  }
  function move(index: number, to: number) {
    setImages((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  }
  async function save(submit: boolean) {
    const originalPhotoStillAttached = initial?.images.some((original) =>
      images.some((image) => image.id === original.id),
    );
    if (
      initial &&
      ((initial.data.watermarkName ?? "").trim() !==
        data.watermarkName.trim() ||
        (initial.data.creci ?? "").trim() !== data.creci.trim()) &&
      originalPhotoStillAttached
    ) {
      setMessage(
        "A marca d'água mudou. Remova as fotos antigas e envie-as novamente para aplicar o novo nome e CRECI.",
      );
      setStep(4);
      return;
    }
    const parsedAmounts = {} as Record<AmountKey, number>;
    for (const key of Object.keys(amountLabels) as AmountKey[]) {
      const parsed = parsePropertyAmount(amounts[key]);
      if (parsed === null) {
        setMessage(
          `Confira ${amountLabels[key]}: use o formato 2.659.574,47, com no máximo duas casas decimais.`,
        );
        setStep(3);
        return;
      }
      parsedAmounts[key] = parsed;
    }
    setBusy(true);
    setMessage("");
    try {
      await estateRequest(
        initial ? `/${initial.id}` : "",
        initial ? "PATCH" : "POST",
        {
          ...data,
          ...parsedAmounts,
          phone,
          address,
          zip,
          consent,
          imageIds: images.map((i) => i.id),
          submit,
          revision: initial?.revision ?? 0,
        },
      );
      router.push("/imoveis/meus-anuncios");
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const drop = (event: DragEvent) => {
    event.preventDefault();
    void upload(event.dataTransfer.files);
  };
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-brand-primary">
        Gratuito · Contato direto · Publicação após análise
      </p>
      <h1 className="mb-3 mt-2 text-3xl font-bold">
        {initial ? "Editar seu anúncio" : "Vamos encontrar o próximo morador?"}
      </h1>
      <p className="mb-8 text-zinc-500">
        Capriche nas informações e nas fotos. Você pode salvar um rascunho antes
        de enviar.
      </p>
      <ol aria-label="Etapas do anúncio" className="mb-6 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs ${i === step ? "bg-brand-primary font-semibold text-white" : "bg-zinc-100 text-zinc-500"}`}
          >
            <span>{i < step ? <Check size={13} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <form
        ref={form}
        className="estate-panel space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 4) {
            setStep((s) => s + 1);
            setMessage("");
          } else void save(true);
        }}
      >
        <h2 className="text-xl font-semibold">{steps[step]}</h2>
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {text("title", "Título do anúncio")}
            </div>
            {select("purpose", "Finalidade", PURPOSES)}
            {select("type", "Tipo de imóvel", config.types)}
            {select("condition", "Condição", [
              "Novo",
              "Usado",
              "Em construção",
            ])}
            <label className="sm:col-span-2">
              Descrição completa
              <textarea
                rows={7}
                required
                minLength={40}
                maxLength={10000}
                value={data.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Conte o que torna esse imóvel especial. Não inclua número do imóvel, telefone ou dados pessoais na descrição pública."
              />
            </label>
          </div>
        )}
        {step === 1 && (
          <>
            <div className="rounded-xl bg-brand-primary-soft p-4 text-sm text-brand-primary">
              Publicamos apenas cidade e bairro. O endereço e o CEP ficam
              privados. O mapa aponta para a região informada.
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {select("state", "Estado", STATES)}
              {text("city", "Cidade")}
              {text("neighborhood", "Bairro")}
              <label>
                CEP (privado, opcional)
                <input
                  maxLength={9}
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </label>
              <label className="sm:col-span-2">
                Endereço completo (privado, opcional)
                <input
                  maxLength={300}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {number("area", "Área total (m²)", true)}
              {data.type !== "Terreno" &&
                number("builtArea", "Área construída (m²)")}
              {!["Terreno", "Galpão", "Sala comercial"].includes(data.type) && (
                <>
                  {number("bedrooms", "Quartos")}
                  {number("suites", "Suítes")}
                </>
              )}
              {data.type !== "Terreno" && number("bathrooms", "Banheiros")}
              {number("parking", "Vagas de garagem")}
            </div>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 font-semibold">
                O que o imóvel oferece?
              </legend>
              {config.features.map((f) => (
                <label key={f}>
                  <input
                    type="checkbox"
                    checked={data.features.includes(f)}
                    onChange={(e) =>
                      update(
                        "features",
                        e.target.checked
                          ? [...data.features, f]
                          : data.features.filter((v) => v !== f),
                      )
                    }
                  />
                  {f}
                </label>
              ))}
            </fieldset>
          </>
        )}
        {step === 3 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {currency(
                "price",
                data.purpose === "Venda"
                  ? "Preço de venda (R$)"
                  : data.purpose === "Temporada"
                    ? "Preço por diária (R$)"
                    : "Aluguel mensal (R$)",
                true,
              )}
              {currency("condo", "Condomínio mensal (R$)")}
              {currency("iptu", "IPTU anual (R$)")}
              {currency("fees", "Outras taxas mensais (R$)")}
              {text("advertiser", "Nome público do anunciante")}
              {select("advertiserType", "Quem anuncia?", [
                "Proprietário",
                "Corretor",
                "Imobiliária",
              ])}
              {data.advertiserType !== "Proprietário" &&
                text("creci", "CRECI (ex.: SP 123456-F)")}
              {text(
                "watermarkName",
                "Nome da corretora na marca d'água",
                data.advertiserType !== "Proprietário",
              )}
              <p className="text-sm text-zinc-500 sm:col-span-2">
                Esse nome será gravado nas fotos do anúncio. Se mudar o nome
                depois, será necessário enviar as fotos novamente.
              </p>
              <label className="sm:col-span-2">
                Link do vídeo no YouTube (opcional)
                <input
                  type="url"
                  inputMode="url"
                  maxLength={2048}
                  placeholder="https://youtu.be/…"
                  value={data.videoUrl}
                  onChange={(e) => update("videoUrl", e.target.value)}
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  Aceitamos links de vídeos, Shorts e lives públicas do YouTube.
                </span>
              </label>
              <label>
                WhatsApp com DDD
                <input
                  type="tel"
                  required
                  maxLength={25}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-5">
              {(
                [
                  ["financing", "Possibilidade de financiamento"],
                  ["exchange", "Aceita permuta"],
                  ["negotiable", "Preço negociável"],
                ] as const
              ).map(([k, l]) => (
                <label key={k}>
                  <input
                    type="checkbox"
                    checked={data[k]}
                    onChange={(e) => update(k, e.target.checked)}
                  />
                  {l}
                </label>
              ))}
            </div>
            <label className="rounded-xl bg-zinc-50 p-4 leading-relaxed">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Tenho autorização para anunciar este imóvel e usar estas fotos.
              Autorizo o uso do WhatsApp para contato dos interessados e aceito
              os{" "}
              <a href="/termos-de-uso" target="_blank" className="underline">
                termos de uso
              </a>{" "}
              e a{" "}
              <a href="/privacidade" target="_blank" className="underline">
                política de privacidade
              </a>
              .
            </label>
            <p className="text-xs text-zinc-500">
              O CRECI é informado pelo anunciante e será avaliado na moderação;
              não representa certificação da Alilu.
            </p>
          </>
        )}
        {step === 4 && (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={drop}
              className="rounded-2xl border-2 border-dashed border-brand-primary/30 bg-brand-primary-soft/40 p-7 text-center"
            >
              <Camera className="mx-auto mb-3 text-brand-primary" size={32} />
              <label className="cursor-pointer text-brand-primary">
                {uploading
                  ? "Preparando e enviando fotos…"
                  : "Escolha as fotos ou arraste para cá"}
                <input
                  aria-label="Selecionar fotos do imóvel"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={busy || uploading}
                  className="mt-3"
                  onChange={(e) => {
                    if (e.target.files) void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="mt-3 text-xs text-zinc-500">
                {images.length} / {config.maxPhotos} fotos · JPEG, PNG ou WebP ·
                Até 15 MB por original. A primeira é a capa.
                {data.watermarkName.trim() &&
                  ` Marca d'água: ${data.watermarkName.trim()}${
                    data.creci.trim() ? ` · CRECI ${data.creci.trim()}` : ""
                  }.`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className="overflow-hidden rounded-xl border border-zinc-200"
                >
                  <img
                    src={image.thumbnail}
                    width={480}
                    height={360}
                    alt={`Foto ${index + 1}`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="space-y-2 p-2">
                    <p className="text-xs font-semibold">
                      {index === 0 ? "Foto principal" : `Foto ${index + 1}`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`Mover foto ${index + 1} para antes`}
                        disabled={!index || uploading || busy}
                        className="estate-button secondary"
                        onClick={() => move(index, index - 1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover foto ${index + 1} para depois`}
                        disabled={
                          index === images.length - 1 || uploading || busy
                        }
                        className="estate-button secondary"
                        onClick={() => move(index, index + 1)}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        disabled={uploading || busy}
                        className="text-xs text-red-700 underline"
                        onClick={() => void remove(image)}
                      >
                        Remover
                      </button>
                    </div>
                    {index > 0 && (
                      <button
                        type="button"
                        disabled={uploading || busy}
                        className="text-xs text-brand-primary underline"
                        onClick={() => move(index, 0)}
                      >
                        Tornar principal
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-zinc-50 p-5">
              <h3 className="font-semibold">
                {data.title || "Revise seu anúncio"}
              </h3>
              <p className="mt-2 text-sm">
                {data.type} · {data.purpose} · {data.neighborhood}, {data.city}{" "}
                / {data.state}
              </p>
              <p className="mt-2 text-sm">
                Ao enviar, o anúncio aguardará análise da Alilu. Alterações
                posteriores também passam por nova análise.
              </p>
            </div>
          </>
        )}
        {message && (
          <p
            role="alert"
            className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            {message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
          {step > 0 && (
            <button
              type="button"
              disabled={busy || uploading}
              className="estate-button secondary"
              onClick={() => {
                setStep((s) => s - 1);
                setMessage("");
              }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          <button
            type="button"
            disabled={busy || uploading}
            className="mr-auto text-sm text-brand-primary underline"
            onClick={() => void save(false)}
          >
            Salvar rascunho
          </button>
          <button disabled={busy || uploading} className="estate-button">
            {busy
              ? "Salvando…"
              : step === 4
                ? "Enviar para análise"
                : "Continuar"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
