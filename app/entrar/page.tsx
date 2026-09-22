"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

type Step = "email" | "code";

/**
 * Página de login do módulo de publicação no Instagram (Fase 3). Não é
 * indexada (ver app/robots.ts) — é uma tela de autenticação, não conteúdo.
 *
 * Duas formas de entrar: Google, ou código de 6 dígitos enviado por
 * e-mail. Enquanto o App Review da Meta não libera o uso público, qualquer
 * pessoa pode logar aqui — só quem já está cadastrado como "tester" no
 * painel do app da Meta consegue de fato conectar o Instagram depois de
 * logado (a própria Meta impõe essa restrição no momento da conexão).
 */
export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/instagram/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        setErrorMessage(data.error ?? "Não foi possível enviar o código.");
        return;
      }

      setStep("code");
    } catch {
      setErrorMessage("Não foi possível enviar o código. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("email-otp", { email, code, redirect: false });
      if (!result || result.error) {
        setErrorMessage("Código incorreto ou expirado. Tente novamente ou peça um novo código.");
        return;
      }

      window.location.href = "/instagram/painel";
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Entrar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Entre para conectar seu Instagram e publicar pelo ALILU.
        </p>
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/instagram/painel" })}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        Continuar com Google
      </button>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200" />
        ou
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="flex flex-col gap-3">
          <label htmlFor="login-email" className="text-sm font-medium text-zinc-700">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-md bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar código por e-mail"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600">
            Enviamos um código de 6 dígitos para <strong>{email}</strong>.
          </p>
          <label htmlFor="login-code" className="text-sm font-medium text-zinc-700">
            Código
          </label>
          <input
            id="login-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="h-11 rounded-md border border-zinc-300 px-3 text-center text-lg tracking-[0.3em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-md bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {isSubmitting ? "Verificando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setErrorMessage(null);
            }}
            className="text-xs text-zinc-500 underline underline-offset-2"
          >
            Usar outro e-mail
          </button>
        </form>
      )}

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
