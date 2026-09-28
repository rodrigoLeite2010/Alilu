"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  removeAccountDefaultMusic,
  updateAccountDefaultMusic,
} from "@/lib/instagram/client/publication-api";
import type { AccountDefaultMusic } from "@/lib/instagram/backend/music-support";

const MAX_FIELD = 200;

/**
 * "Música padrão para publicações" da conta — tela de contas conectadas
 * (app/instagram/painel/page.tsx). Configura a música/trilha que novas
 * publicações usam automaticamente (musicMode = "ACCOUNT_DEFAULT" por
 * padrão, ver instagram-post-service.ts); o usuário não precisa escolher
 * de novo a cada post.
 *
 * A API atualmente usada pelo projeto ("Instagram API with Instagram
 * Login") não aplica música automaticamente a NENHUM tipo de publicação
 * hoje (ver lib/instagram/backend/music-support.ts) — por isso o aviso
 * fixo abaixo. A configuração fica salva mesmo assim, pronta para
 * quando/se a Meta passar a suportar isso, e nunca bloqueia a
 * publicação normal.
 */
export function DefaultMusicSettings({ initialDefaultMusic }: { initialDefaultMusic: AccountDefaultMusic }) {
  const enabledId = useId();
  const nameId = useId();
  const artistId = useId();
  const externalIdId = useId();
  const urlId = useId();
  const audioUrlId = useId();
  const audioNameId = useId();

  const [music, setMusic] = useState(initialDefaultMusic);
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(initialDefaultMusic.enabled);
  const [type, setType] = useState<"InstagramCatalog" | "CustomAudio">(
    initialDefaultMusic.type === "CustomAudio" ? "CustomAudio" : "InstagramCatalog",
  );
  const [name, setName] = useState(initialDefaultMusic.name ?? "");
  const [artist, setArtist] = useState(initialDefaultMusic.artist ?? "");
  const [externalId, setExternalId] = useState(initialDefaultMusic.externalId ?? "");
  const [url, setUrl] = useState(initialDefaultMusic.url ?? "");
  const [audioFileUrl, setAudioFileUrl] = useState(initialDefaultMusic.audioFileUrl ?? "");
  const [audioFileName, setAudioFileName] = useState(initialDefaultMusic.audioFileName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function startEditing() {
    setEnabled(music.enabled);
    setType(music.type === "CustomAudio" ? "CustomAudio" : "InstagramCatalog");
    setName(music.name ?? "");
    setArtist(music.artist ?? "");
    setExternalId(music.externalId ?? "");
    setUrl(music.url ?? "");
    setAudioFileUrl(music.audioFileUrl ?? "");
    setAudioFileName(music.audioFileName ?? "");
    setError(null);
    setSavedMessage(null);
    setEditing(true);
  }

  async function handleSave() {
    if (busy) return;
    setError(null);
    const fields = [name, artist, externalId, url, audioFileUrl, audioFileName];
    if (fields.some((field) => field.length > MAX_FIELD)) {
      setError(`Cada campo pode ter no máximo ${MAX_FIELD} caracteres.`);
      return;
    }
    setBusy(true);
    try {
      const updated = await updateAccountDefaultMusic({
        enabled,
        type: enabled ? type : "None",
        name: type === "InstagramCatalog" ? name.trim() || null : null,
        artist: type === "InstagramCatalog" ? artist.trim() || null : null,
        externalId: type === "InstagramCatalog" ? externalId.trim() || null : null,
        url: type === "InstagramCatalog" ? url.trim() || null : null,
        audioFileUrl: type === "CustomAudio" ? audioFileUrl.trim() || null : null,
        audioFileName: type === "CustomAudio" ? audioFileName.trim() || null : null,
      });
      setMusic(updated);
      setEditing(false);
      setSavedMessage("Música padrão salva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a música padrão.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await removeAccountDefaultMusic();
      setMusic(updated);
      setEditing(false);
      setSavedMessage("Música padrão removida.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a música padrão.");
    } finally {
      setBusy(false);
    }
  }

  const displayName = music.name || (music.type === "CustomAudio" ? music.audioFileName : null);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-3">
      <h2 className="text-sm font-semibold text-zinc-800">Música padrão para publicações</h2>

      {!editing ? (
        <>
          {music.enabled ? (
            <p className="text-sm text-zinc-700">
              🎵 Música: <strong>{displayName || "configurada"}</strong>
              {music.artist ? ` — ${music.artist}` : ""}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Nenhuma música padrão configurada.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={startEditing} disabled={busy}>
              {music.enabled ? "Alterar música" : "Configurar música padrão"}
            </Button>
            {music.enabled ? (
              <Button type="button" variant="ghost" onClick={() => void handleRemove()} disabled={busy}>
                Remover música padrão
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <label htmlFor={enabledId} className="flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input
              id={enabledId}
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            Usar música padrão automaticamente em novas publicações
          </label>

          {enabled ? (
            <>
              <div className="flex gap-4 text-sm text-zinc-700">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="default-music-type"
                    checked={type === "InstagramCatalog"}
                    disabled={busy}
                    onChange={() => setType("InstagramCatalog")}
                    className="h-4 w-4 accent-teal-700"
                  />
                  Música do catálogo do Instagram
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="default-music-type"
                    checked={type === "CustomAudio"}
                    disabled={busy}
                    onChange={() => setType("CustomAudio")}
                    className="h-4 w-4 accent-teal-700"
                  />
                  Trilha própria
                </label>
              </div>

              {type === "InstagramCatalog" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={nameId} className="text-xs font-medium text-zinc-700">
                      Nome da música
                    </label>
                    <input
                      id={nameId}
                      value={name}
                      disabled={busy}
                      maxLength={MAX_FIELD}
                      onChange={(event) => setName(event.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={artistId} className="text-xs font-medium text-zinc-700">
                      Artista
                    </label>
                    <input
                      id={artistId}
                      value={artist}
                      disabled={busy}
                      maxLength={MAX_FIELD}
                      onChange={(event) => setArtist(event.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={externalIdId} className="text-xs font-medium text-zinc-700">
                      ID da música (opcional)
                    </label>
                    <input
                      id={externalIdId}
                      value={externalId}
                      disabled={busy}
                      maxLength={MAX_FIELD}
                      onChange={(event) => setExternalId(event.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={urlId} className="text-xs font-medium text-zinc-700">
                      URL/referência (opcional)
                    </label>
                    <input
                      id={urlId}
                      value={url}
                      disabled={busy}
                      maxLength={MAX_FIELD}
                      onChange={(event) => setUrl(event.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={audioNameId} className="text-xs font-medium text-zinc-700">
                      Nome do arquivo
                    </label>
                    <input
                      id={audioNameId}
                      value={audioFileName}
                      disabled={busy}
                      maxLength={MAX_FIELD}
                      placeholder="motivacional-alilu.mp3"
                      onChange={(event) => setAudioFileName(event.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor={audioUrlId} className="text-xs font-medium text-zinc-700">
                      URL do áudio (MP3, M4A ou AAC)
                    </label>
                    <input
                      id={audioUrlId}
                      value={audioFileUrl}
                      disabled={busy}
                      maxLength={MAX_FIELD}
                      onChange={(event) => setAudioFileUrl(event.target.value)}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                    />
                  </div>
                </div>
              )}
            </>
          ) : null}

          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Música do catálogo do Instagram não pode ser adicionada automaticamente neste tipo de publicação pela API
            atual. A configuração fica salva e passa a ser usada automaticamente assim que a Meta liberar esse
            recurso na API.
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {savedMessage && !editing ? (
        <p role="status" className="text-xs text-teal-700">
          {savedMessage}
        </p>
      ) : null}
    </div>
  );
}
