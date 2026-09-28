"use client";

import { useId, useState } from "react";
import type { MusicMode, MusicType } from "@/lib/instagram/backend/music-support";
import type { PostMusicSelectionBody } from "@/lib/instagram/client/publication-api";

const MAX_FIELD = 200;

export interface MusicSelectorAccountDefault {
  enabled: boolean;
  name: string | null;
  artist: string | null;
}

/**
 * Seletor de música na criação/agendamento de post — image, carrossel e
 * Reels. Minimalista por padrão ("🎵 Música: Padrão da conta [Alterar]",
 * ver especificação), expande só quando o usuário clica em "Alterar".
 *
 * Pré-seleção: `musicMode` já chega como "ACCOUNT_DEFAULT" do estado do
 * compositor (regra padrão de instagram-post-service.ts) — o usuário não
 * precisa mexer aqui a cada post, só quando quiser trocar.
 */
export function MusicSelector({
  accountDefaultMusic,
  musicMode,
  onMusicModeChange,
  musicSelection,
  onMusicSelectionChange,
  disabled,
}: {
  accountDefaultMusic?: MusicSelectorAccountDefault;
  musicMode: MusicMode;
  onMusicModeChange: (mode: MusicMode) => void;
  musicSelection: PostMusicSelectionBody | null;
  onMusicSelectionChange: (selection: PostMusicSelectionBody | null) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const nameId = useId();
  const artistId = useId();
  const audioUrlId = useId();
  const audioNameId = useId();

  const hasAccountDefault = Boolean(accountDefaultMusic?.enabled);
  const customType: MusicType = musicSelection?.type === "CustomAudio" ? "CustomAudio" : "InstagramCatalog";

  function updateCustom(patch: Partial<PostMusicSelectionBody>) {
    onMusicSelectionChange({
      type: customType,
      name: null,
      artist: null,
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
      ...musicSelection,
      ...patch,
    });
  }

  function summary(): string {
    if (musicMode === "NONE") return "Sem música";
    if (musicMode === "CUSTOM") {
      const label = musicSelection?.name || musicSelection?.audioFileName;
      return label ? `${label}${musicSelection?.artist ? ` — ${musicSelection.artist}` : ""}` : "Outra música";
    }
    // ACCOUNT_DEFAULT
    if (hasAccountDefault) {
      return accountDefaultMusic?.name
        ? `Padrão da conta — ${accountDefaultMusic.name}${accountDefaultMusic.artist ? ` (${accountDefaultMusic.artist})` : ""}`
        : "Padrão da conta";
    }
    return "Padrão da conta (nenhuma configurada)";
  }

  if (!expanded) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
        <span>🎵 Música: {summary()}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setExpanded(true)}
          className="text-xs font-medium text-teal-700 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Alterar
        </button>
      </div>
    );
  }

  return (
    <fieldset className="space-y-2 rounded-md border border-zinc-200 p-3">
      <legend className="text-sm font-medium text-zinc-800">Música</legend>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="radio"
          name="music-mode"
          checked={musicMode === "ACCOUNT_DEFAULT"}
          disabled={disabled}
          onChange={() => onMusicModeChange("ACCOUNT_DEFAULT")}
          className="h-4 w-4 accent-teal-700"
        />
        Usar música padrão da conta
        {hasAccountDefault ? (
          <span className="text-xs text-zinc-500">
            ({accountDefaultMusic?.name ?? "configurada"}
            {accountDefaultMusic?.artist ? ` — ${accountDefaultMusic.artist}` : ""})
          </span>
        ) : (
          <span className="text-xs text-zinc-400">(nenhuma música padrão configurada nesta conta)</span>
        )}
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="radio"
          name="music-mode"
          checked={musicMode === "NONE"}
          disabled={disabled}
          onChange={() => onMusicModeChange("NONE")}
          className="h-4 w-4 accent-teal-700"
        />
        Publicar sem música
      </label>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="radio"
          name="music-mode"
          checked={musicMode === "CUSTOM"}
          disabled={disabled}
          onChange={() => onMusicModeChange("CUSTOM")}
          className="h-4 w-4 accent-teal-700"
        />
        Escolher outra música
      </label>

      {musicMode === "CUSTOM" ? (
        <div className="space-y-2 border-t border-zinc-100 pt-2">
          <div className="flex gap-4 text-xs text-zinc-700">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="music-custom-type"
                checked={customType === "InstagramCatalog"}
                disabled={disabled}
                onChange={() => updateCustom({ type: "InstagramCatalog" })}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              Catálogo do Instagram
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="music-custom-type"
                checked={customType === "CustomAudio"}
                disabled={disabled}
                onChange={() => updateCustom({ type: "CustomAudio" })}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              Trilha própria
            </label>
          </div>

          {customType === "InstagramCatalog" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={nameId} className="text-xs font-medium text-zinc-700">
                  Nome da música
                </label>
                <input
                  id={nameId}
                  value={musicSelection?.name ?? ""}
                  disabled={disabled}
                  maxLength={MAX_FIELD}
                  onChange={(event) => updateCustom({ name: event.target.value })}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={artistId} className="text-xs font-medium text-zinc-700">
                  Artista
                </label>
                <input
                  id={artistId}
                  value={musicSelection?.artist ?? ""}
                  disabled={disabled}
                  maxLength={MAX_FIELD}
                  onChange={(event) => updateCustom({ artist: event.target.value })}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={audioNameId} className="text-xs font-medium text-zinc-700">
                  Nome do arquivo
                </label>
                <input
                  id={audioNameId}
                  value={musicSelection?.audioFileName ?? ""}
                  disabled={disabled}
                  maxLength={MAX_FIELD}
                  onChange={(event) => updateCustom({ audioFileName: event.target.value })}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={audioUrlId} className="text-xs font-medium text-zinc-700">
                  URL do áudio
                </label>
                <input
                  id={audioUrlId}
                  value={musicSelection?.audioFileUrl ?? ""}
                  disabled={disabled}
                  maxLength={MAX_FIELD}
                  onChange={(event) => updateCustom({ audioFileUrl: event.target.value })}
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
        Música do catálogo do Instagram não pode ser adicionada automaticamente neste tipo de publicação pela API
        atual. A publicação segue normalmente sem a música.
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setExpanded(false)}
        className="text-xs font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
      >
        Fechar
      </button>
    </fieldset>
  );
}
