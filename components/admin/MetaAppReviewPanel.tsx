"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import type { ReviewOverview } from "@/lib/instagram/backend/meta-app-review-service";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { CHECKLIST_LABEL, RECORDING_SCRIPT, REVIEW_TEXT, SUBMISSION_TEXT, type ReviewLang } from "@/lib/instagram/meta-app-review/i18n";

const card = "rounded-lg border border-zinc-200 bg-white p-5";
const primary = "inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium ring-1 ring-zinc-300 disabled:opacity-50";
const POLL_MS = 8_000;
const MAX_ROUNDS = 10;

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function CopyButton({ text, label, copied }: { text: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? copied : label}
    </button>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 py-1.5 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="break-all font-medium text-zinc-900">{value}</span>
    </div>
  );
}

/**
 * Painel de demonstração para o App Review. Tudo é real: o OAuth é o do
 * Alilu, a publicação usa as rotas existentes (/api/instagram/posts e
 * /api/instagram/posts/[id]/publish) e as confirmações vêm da API da Meta.
 * Nada é publicado sem o clique do administrador em "Publish Reel".
 */
export function MetaAppReviewPanel({ userId, initialLang }: { userId: string; initialLang: ReviewLang }) {
  const [lang, setLang] = useState<ReviewLang>(initialLang);
  const t = REVIEW_TEXT[lang];
  const [data, setData] = useState<ReviewOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [accountId, setAccountId] = useState("");
  const [ownVideo, setOwnVideo] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "processing" | "failed">("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const fetchOverview = useCallback(async (): Promise<ReviewOverview | string> => {
    const response = await fetch("/api/admin/meta-app-review", { cache: "no-store" });
    return response.ok ? ((await response.json()) as ReviewOverview) : readError(response, "Erro");
  }, []);
  const apply = useCallback((result: ReviewOverview | string) => {
    if (typeof result === "string") setError(result);
    else setData(result);
  }, []);
  const reload = useCallback(async () => apply(await fetchOverview()), [apply, fetchOverview]);

  useEffect(() => {
    let cancelled = false;
    fetchOverview().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, fetchOverview]);

  const changeLang = (next: ReviewLang) => {
    setLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url.toString());
  };

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/meta-app-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(await readError(response, t.errorGeneric));
    return (await response.json()) as Record<string, unknown>;
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorGeneric);
    } finally {
      setBusy(null);
    }
  };

  const instagramAccounts = useMemo(() => (data?.accounts ?? []).filter((account) => account.authProvider === "instagram_login"), [data]);
  const selected = data?.accounts.find((account) => account.id === data.selectedAccountId) ?? null;
  const targetAccountId = accountId || (selected?.authProvider === "instagram_login" && selected.status === "connected" ? selected.id : "");
  const targetAccount = instagramAccounts.find((account) => account.id === targetAccountId) ?? null;
  const returnTo = `/admin/meta-app-review?lang=${lang}`;
  const connectHref = `/api/instagram/oauth/start?returnTo=${encodeURIComponent(returnTo)}&forceReauth=1`;

  const uploadVideo = (file: File) =>
    run("upload", async () => {
      if (!["video/mp4", "video/quicktime"].includes(file.type)) throw new Error(t.invalidVideo);
      const extension = file.name.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
      const fileName = `meta-review-${Date.now()}.${extension}`;
      const uploaded = await uploadPresigned(`${buildMediaPathnamePrefix(userId)}${fileName}`, file, {
        access: "public",
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({ originalFilename: fileName, fileSizeBytes: file.size, contentType: file.type }),
      });
      setVideoUrl(uploaded.url);
    });

  const createPost = () =>
    run("create", async () => {
      if (!videoUrl) throw new Error(t.uploadVideo);
      if (!targetAccountId) throw new Error(t.noAccount);
      if (!ownVideo) throw new Error(t.confirmOwn);
      // Agendador EXISTENTE: cria um rascunho (nada vai ao Instagram sem "Publish Reel").
      const response = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postType: "reels", mediaUrl: videoUrl, caption, scheduledAt: null, instagramAccountId: targetAccountId }),
      });
      if (!response.ok) throw new Error(await readError(response, t.errorGeneric));
      const { postId } = (await response.json()) as { postId: string };
      await post({ action: "set_post", postId });
      setPublishState("idle");
      setPublishMessage(null);
    });

  /** Publica pelo publicador EXISTENTE; enquanto a Meta processa, retoma a MESMA publicação (idempotente). */
  const publish = async () => {
    const postId = data?.post?.id;
    if (!postId || publishState === "publishing") return;
    setPublishState("publishing");
    setPublishMessage(t.publishingHelp);
    setError(null);
    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const response = await fetch(`/api/instagram/posts/${postId}/publish?platform=instagram`, { method: "POST" });
        const body = (await response.json().catch(() => ({}))) as { status?: string; instagram?: string; error?: string };
        if (!response.ok) throw new Error(body.error || t.errorGeneric);
        if ((body.instagram ?? body.status) === "PUBLISHED") {
          // Sucesso só depois de confirmar na API da Meta.
          const verification = await post({ action: "verify_publication" });
          if (verification.ok !== true) throw new Error(String(verification.error ?? t.errorGeneric));
          setPublishState("published");
          setPublishMessage(t.published);
          await reload();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      setPublishState("processing");
      setPublishMessage(t.stillProcessing);
      await reload();
    } catch (err) {
      setPublishState("failed");
      setPublishMessage(`${t.publishFailed}: ${err instanceof Error ? err.message : t.errorGeneric}`);
      await reload();
    }
  };

  if (error && !data) return <p className="text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-zinc-500">{t.loading}</p>;

  const fmtDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString(lang === "en" ? "en-US" : "pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "medium", timeStyle: "short" }) : t.none;
  const yesNo = (value: boolean | null) => (value === null ? t.unknown : value ? t.yes : t.no);
  const profile = data.profile;
  const verified = data.verified;
  const confirmedPublished = Boolean(data.post?.status === "PUBLISHED" && verified);
  const scriptText = RECORDING_SCRIPT.map((scene) => `${scene.scene}\nNarration: "${scene.narration}"\n${scene.actions.map((action) => `- ${action}`).join("\n")}`).join("\n\n");
  const subtitles = RECORDING_SCRIPT.map((scene) => scene.narration).join("\n");

  return (
    <div className="space-y-6" lang={lang === "en" ? "en" : "pt-BR"}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{t.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">{t.subtitle}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {t.sessionStarted} {fmtDate(data.session.startedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 rounded-md bg-zinc-100 p-1 text-sm" role="group" aria-label={t.language}>
            {(["pt", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={lang === option}
                onClick={() => changeLang(option)}
                className={`rounded px-3 py-1 font-medium ${lang === option ? "bg-white shadow" : "text-zinc-600"}`}
              >
                {option === "pt" ? "Português" : "English"}
              </button>
            ))}
          </div>
          <button type="button" className={secondary} disabled={busy !== null} title={t.newSessionHelp} onClick={() => run("session", async () => void (await post({ action: "start_session" })))}>
            {t.newSession}
          </button>
        </div>
      </header>

      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="space-y-6">
          <section className={card}>
            <h2 className="text-lg font-semibold text-zinc-900">{t.step1}</h2>
            <p className="mt-2 text-sm text-zinc-700">
              {t.step1Help} <code className="rounded bg-zinc-100 px-1">https://alilu.com.br/entrar</code>.
            </p>
            <a className={`${secondary} mt-3`} href={`/entrar?callbackUrl=${encodeURIComponent(returnTo)}`}>
              {t.step1Open}
            </a>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-zinc-900">{t.step2}</h2>
            <p className="mt-2 text-sm text-zinc-700">{t.step2Help}</p>
            <p className="mt-1 text-xs text-zinc-500">Scopes: {data.config.requestedScopes.join(", ")}</p>
            <a className={`${primary} mt-3`} href={connectHref}>
              {t.connect}
            </a>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-zinc-900">{t.step3}</h2>
            {instagramAccounts.length === 0 ? <p className="mt-2 text-sm text-zinc-600">{t.noAccount}</p> : null}
            {selected && selected.authProvider !== "instagram_login" ? <p className="mt-2 text-sm text-amber-800">{t.facebookLoginNote}</p> : null}
            {instagramAccounts.length > 0 ? (
              <div className="mt-3 space-y-3">
                <label className="block text-sm font-medium text-zinc-800">
                  {t.account}
                  <select className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={targetAccountId} onChange={(event) => setAccountId(event.target.value)}>
                    <option value="">—</option>
                    {instagramAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        @{account.username ?? account.igUserId} ({account.status})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={primary}
                  disabled={!targetAccountId || busy !== null}
                  onClick={() =>
                    run("profile", async () => {
                      const result = await post({ action: "refresh_profile", accountId: targetAccountId });
                      if (result.ok !== true) throw new Error(String(result.error));
                    })
                  }
                >
                  {busy === "profile" ? t.loading : t.refreshProfile}
                </button>
                {profile ? (
                  <div className="flex flex-wrap items-start gap-4 rounded-md bg-zinc-50 p-3">
                    {profile.profilePictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.profilePictureUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                    ) : null}
                    <div className="min-w-[240px] flex-1">
                      {profile.username ? <Field label={t.username} value={`@${profile.username}`} /> : null}
                      <Field label={t.accountId} value={profile.userId} />
                      {profile.name ? <Field label={t.name} value={profile.name} /> : null}
                      {profile.accountType ? <Field label={t.accountType} value={profile.accountType} /> : null}
                      {profile.mediaCount !== null ? <Field label={t.mediaCount} value={profile.mediaCount} /> : null}
                      <Field label={t.connectionStatus} value={data.accounts.find((account) => account.igUserId === profile.userId)?.status ?? t.unknown} />
                      <Field label={t.returnedFields} value={profile.returnedFields.join(", ")} />
                      <Field label={t.lastQuery} value={fmtDate(data.profileCheckedAt)} />
                    </div>
                  </div>
                ) : null}
                {data.profileError ? <p className="text-sm text-red-700">{data.profileError}</p> : null}
                <p className="text-sm font-medium text-teal-800">{t.step3Explain}</p>
                {targetAccountId ? (
                  <a className="text-xs text-zinc-600 underline" href={`/api/instagram/oauth/start?returnTo=${encodeURIComponent(returnTo)}&accountId=${targetAccountId}`}>
                    {t.reconnect}
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-zinc-900">{t.step4}</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-medium text-zinc-800">
                {t.uploadVideo}
                <input
                  type="file"
                  accept="video/mp4,video/quicktime"
                  className="mt-1 block text-sm"
                  disabled={busy !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadVideo(file);
                  }}
                />
              </label>
              {busy === "upload" ? <p className="text-sm text-zinc-600">{t.uploading}</p> : null}
              {data.videos.length > 0 ? (
                <label className="block text-sm font-medium text-zinc-800">
                  {t.orChoose}
                  <select className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={videoUrl ?? ""} onChange={(event) => setVideoUrl(event.target.value || null)}>
                    <option value="">—</option>
                    {data.videos.map((video) => (
                      <option key={video.id} value={video.url}>
                        {video.name ?? video.id} · {fmtDate(video.createdAt)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {videoUrl ? <video src={videoUrl} controls playsInline className="max-h-96 rounded-md bg-black" /> : null}
              <label className="block text-sm font-medium text-zinc-800">
                {t.caption}
                <textarea className="mt-1 h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" maxLength={2200} placeholder={t.captionPlaceholder} value={caption} onChange={(event) => setCaption(event.target.value)} />
              </label>
              <p className="text-sm text-zinc-700">
                {t.targetAccount}: <strong>{targetAccount ? `@${targetAccount.username ?? targetAccount.igUserId}` : t.none}</strong>
              </p>
              <label className="flex items-start gap-2 text-sm text-zinc-800">
                <input type="checkbox" className="mt-1" checked={ownVideo} onChange={(event) => setOwnVideo(event.target.checked)} />
                {t.confirmOwn}
              </label>
              <button type="button" className={secondary} disabled={busy !== null || !videoUrl || !targetAccountId || !ownVideo} onClick={createPost}>
                {t.createPost}
              </button>
              {data.post && data.post.status !== "PUBLISHED" && publishState === "idle" ? <p className="text-sm text-zinc-600">{t.postReady}</p> : null}
            </div>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-zinc-900">{t.step5}</h2>
            <button type="button" className={`${primary} mt-3`} disabled={!data.post || publishState === "publishing" || confirmedPublished} onClick={publish}>
              {publishState === "publishing" ? t.publishing : t.publish}
            </button>
            {publishState === "publishing" ? (
              <p className="mt-2 text-sm font-medium text-zinc-800" role="status">
                {t.publishing}
              </p>
            ) : null}
            {publishMessage && publishState !== "idle" ? (
              <p
                role="status"
                className={`mt-2 text-sm ${publishState === "published" ? "font-semibold text-green-700" : publishState === "failed" ? "text-red-700" : "text-zinc-600"}`}
              >
                {publishMessage}
              </p>
            ) : null}
            {confirmedPublished && publishState === "idle" ? <p className="mt-2 text-sm font-semibold text-green-700">{t.published}</p> : null}
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-zinc-900">{t.step6}</h2>
            {data.post ? (
              <div className="mt-3">
                <Field label={t.publicationId} value={verified?.id ?? data.post.metaMediaId ?? t.none} />
                <Field label={t.publicationStatus} value={data.post.status} />
                <Field label={t.publicationDate} value={fmtDate(verified?.timestamp ?? data.post.publishedAt)} />
                <Field label={t.publicationUrl} value={verified?.permalink ?? t.none} />
                {verified?.mediaProductType ? <Field label="media_product_type" value={verified.mediaProductType} /> : null}
                {data.post.lastError ? <p className="mt-2 text-sm text-red-700">{data.post.lastError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondary}
                    disabled={busy !== null || data.post.status !== "PUBLISHED"}
                    onClick={() =>
                      run("verify", async () => {
                        const result = await post({ action: "verify_publication" });
                        if (result.ok !== true) throw new Error(String(result.error));
                      })
                    }
                  >
                    {t.verify}
                  </button>
                  {verified?.permalink ? (
                    <a className={primary} href={verified.permalink} target="_blank" rel="noreferrer">
                      {t.viewOnInstagram}
                    </a>
                  ) : null}
                </div>
                {verified ? <p className="mt-2 text-sm font-medium text-teal-800">{t.step6Explain}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">{t.none}</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className={card}>
            <h2 className="font-semibold text-zinc-900">{t.checklist}</h2>
            <ul className="mt-3 space-y-2">
              {data.checklist.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 w-4 shrink-0 font-bold ${item.done ? "text-green-700" : "text-zinc-300"}`}>{item.done ? "✓" : "○"}</span>
                  <span className="flex-1">
                    <span className="text-zinc-900">{CHECKLIST_LABEL[lang][item.key]}</span>
                    <span className="block text-xs text-zinc-500">{item.manual ? t.manual : t.auto}</span>
                    {item.evidence ? <span className="block break-all text-[11px] text-zinc-400">{item.evidence}</span> : null}
                  </span>
                  {item.manual ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-teal-700"
                      disabled={busy !== null}
                      onClick={() => run(`check-${item.key}`, async () => void (await post({ action: "manual_check", key: item.key, done: !item.done })))}
                    >
                      {item.done ? t.undo : t.confirm}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="font-semibold text-zinc-900">{t.diagnostics}</h2>
            <div className="mt-2">
              <Field label={t.oauthFlow} value={data.config.oauthFlow} />
              <Field label={t.appId} value={data.config.appId ?? t.none} />
              <Field label={t.redirectUri} value={data.config.redirectUri ?? t.none} />
              <Field label={t.accountId} value={selected?.igUserId ?? t.none} />
              <Field label={t.connectionStatus} value={selected?.status ?? t.none} />
              <Field label={t.tokenExpires} value={fmtDate(selected?.tokenExpiresAt)} />
              <Field label={t.lastQuery} value={data.profileCheckedAt ? `${fmtDate(data.profileCheckedAt)} · ${data.profileError ? "error" : "ok"}` : t.none} />
              <Field label={t.lastPublish} value={data.post ? `${data.post.status}${data.post.publishedAt ? ` · ${fmtDate(data.post.publishedAt)}` : ""}` : t.none} />
              <Field label={t.lastMetaError} value={data.lastMetaError ?? t.none} />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="py-1 pr-2">{t.permission}</th>
                    <th className="pr-2">{t.requested}</th>
                    <th className="pr-2">{t.grantedByUser}</th>
                    <th className="pr-2">{t.accessLevel}</th>
                    <th>{t.reviewApproved}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.permissions.map((permission) => (
                    <tr key={permission.scope} className="border-t border-zinc-100 align-top">
                      <td className="py-1 pr-2 font-mono">{permission.scope}</td>
                      <td className="pr-2">{t.yes}</td>
                      <td className="pr-2">{yesNo(permission.grantedByUser)}</td>
                      <td className="pr-2">{t.checkManually}</td>
                      <td>{t.checkManually}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-600">{t.manualVerification}</p>
          </section>
        </aside>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">{t.guide}</h2>
          <div className="flex gap-2">
            <CopyButton text={scriptText} label={t.copyScript} copied={t.copied} />
            <CopyButton text={subtitles} label={t.copySubtitles} copied={t.copied} />
          </div>
        </div>
        <ol className="mt-3 space-y-3" lang="en">
          {RECORDING_SCRIPT.map((scene) => (
            <li key={scene.scene} className="rounded-md bg-zinc-50 p-3 text-sm">
              <p className="font-semibold text-zinc-900">{scene.scene}</p>
              <p className="mt-1 italic text-zinc-700">&ldquo;{scene.narration}&rdquo;</p>
              <ul className="mt-1 list-disc pl-5 text-zinc-600">
                {scene.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-zinc-900">{t.submission}</h2>
        <p className="mt-1 text-xs text-zinc-500">{t.notApprovedWarning}</p>
        <div className="mt-3 space-y-4" lang="en">
          {SUBMISSION_TEXT.map((item) => (
            <div key={item.permission} className="rounded-md bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-zinc-900">{item.permission}</p>
                <CopyButton text={item.description} label={t.copyDescription} copied={t.copied} />
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
