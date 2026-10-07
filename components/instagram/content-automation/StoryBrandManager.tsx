"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { StoryBrandProfileDto } from "@/lib/content-automation/smart-story/brand";
import { removeStoryBrandImage, saveStoryBrandTextsRequest, uploadStoryBrandImage } from "@/lib/content-automation/story-brand-client";

type Slot = "LOGO" | "MASCOT";

const card = "rounded-lg border border-zinc-200 bg-white p-5";
const inputClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

function ImageSlot({
  slot,
  label,
  hint,
  url,
  busy,
  onPick,
  onRemove,
}: {
  slot: Slot;
  label: string;
  hint: string;
  url: string | null;
  busy: boolean;
  onPick: (slot: Slot, file: File) => void;
  onRemove: (slot: Slot) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="h-28 w-28 rounded-md border border-zinc-200 bg-zinc-50 object-contain" />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400">Sem arquivo</div>
      )}
      <div className="flex-1 text-sm">
        <p className="font-medium text-zinc-800">{label}</p>
        <p className="text-xs text-zinc-500">{hint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={`inline-flex cursor-pointer items-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {url ? "Trocar imagem" : "Enviar imagem"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPick(slot, file);
              }}
            />
          </label>
          {url ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => onRemove(slot)}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Minha conta › Identidade dos Stories: a marca que aparece nos Stories inteligentes do usuário. */
export function StoryBrandManager({ userId, initial }: { userId: string; initial: StoryBrandProfileDto }) {
  const [profile, setProfile] = useState(initial);
  const [brandName, setBrandName] = useState(initial.brandName ?? "");
  const [handle, setHandle] = useState(initial.handle ?? "");
  const [site, setSite] = useState(initial.site ?? "");
  const [accentColor, setAccentColor] = useState(initial.accentColor ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<StoryBrandProfileDto>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      setProfile(next);
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const saveTexts = () =>
    run(async () => {
      const next = await saveStoryBrandTextsRequest({ brandName, handle, site, accentColor });
      setHandle(next.handle ?? "");
      setSite(next.site ?? "");
      return next;
    }, "Identidade salva.");

  return (
    <div className="space-y-5">
      {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      {profile.effectiveKind === "NONE" ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Seus Stories inteligentes saem hoje sem marca. Preencha o @ ou o site para liberar o tipo “Marca / Convite” e os convites para seguir ou visitar.
        </p>
      ) : null}
      {profile.effectiveKind === "ALILU" ? (
        <p className="rounded-md bg-sky-50 p-3 text-sm text-sky-800">
          Esta conta usa a identidade do Alilu por padrão. Ao preencher os campos abaixo, ela passa a usar a sua identidade personalizada.
        </p>
      ) : null}

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Textos</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-800">
            Nome da marca
            <input className={inputClass} value={brandName} maxLength={40} placeholder="Studio Ana" onChange={(event) => setBrandName(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-zinc-800">
            @ do Instagram
            <input className={inputClass} value={handle} maxLength={31} placeholder="@meuperfil" onChange={(event) => setHandle(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-zinc-800">
            Site (opcional)
            <input className={inputClass} value={site} maxLength={60} placeholder="meusite.com.br" onChange={(event) => setSite(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-zinc-800">
            Cor de destaque (opcional)
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                aria-label="Escolher cor de destaque"
                className="h-9 w-12 cursor-pointer rounded border border-zinc-300"
                value={/^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#1b7f79"}
                onChange={(event) => setAccentColor(event.target.value)}
              />
              <input className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={accentColor} maxLength={7} placeholder="#1b7f79" onChange={(event) => setAccentColor(event.target.value)} />
            </div>
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          O @ e o logo aparecem discretos no rodapé do Story. O @ e o site alimentam os convites (“Siga @…”, “Acesse …”). Nada é desenhado ou escrito sobre o que você não preencher.
        </p>
        <div className="mt-4">
          <Button type="button" disabled={busy} onClick={() => void saveTexts()}>
            {busy ? "Salvando…" : "Salvar identidade"}
          </Button>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Imagens</h2>
        <ImageSlot
          slot="LOGO"
          label="Logo"
          hint="Opcional. PNG com fundo transparente funciona melhor. Aparece pequeno no rodapé, sobre um fundo claro."
          url={profile.logoUrl}
          busy={busy}
          onPick={(slot, file) => void run(() => uploadStoryBrandImage(userId, slot, file), "Logo salvo.")}
          onRemove={(slot) => void run(() => removeStoryBrandImage(slot), "Logo removido.")}
        />
        <ImageSlot
          slot="MASCOT"
          label="Mascote ou personagem"
          hint="Opcional. Aparece de vez em quando no canto do Story (você escolhe a frequência na automação)."
          url={profile.mascotUrl}
          busy={busy}
          onPick={(slot, file) => void run(() => uploadStoryBrandImage(userId, slot, file), "Mascote salvo.")}
          onRemove={(slot) => void run(() => removeStoryBrandImage(slot), "Mascote removido.")}
        />
      </section>
    </div>
  );
}
