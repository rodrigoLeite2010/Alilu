import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import {
  OtpExpiredError,
  OtpInvalidError,
  OtpTooManyAttemptsError,
  verifyOtp,
} from "@/lib/instagram/backend/otp-service";
import { isValidEmail, normalizeEmail } from "@/lib/instagram/backend/otp";
import { upsertUserByEmail } from "@/lib/instagram/backend/users-store";

/**
 * Configuração central de autenticação (Auth.js v5 / NextAuth), usada por
 * app/api/auth/[...nextauth]/route.ts e por qualquer Server Component ou
 * Route Handler que precise de `auth()` para saber quem está logado.
 *
 * Duas formas de entrar, como decidido: Google, e código de 6 dígitos por
 * e-mail (provider de credenciais próprio, já que o Auth.js não tem um
 * fluxo de OTP pronto — só "link mágico").
 *
 * Sessão em JWT (sem adapter de banco do próprio Auth.js): o "usuário" da
 * sessão é só o necessário para identificar a linha em `users` — toda a
 * criação/atualização do usuário é feita à mão em upsertUserByEmail,
 * chamada uma única vez no callback `jwt`, no login inicial (quando
 * `user`/`account` vêm preenchidos), tanto para Google quanto para o OTP.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/entrar",
  },
  providers: [
    Google,
    Credentials({
      id: "email-otp",
      name: "Código por e-mail",
      credentials: {
        email: { label: "E-mail", type: "email" },
        code: { label: "Código", type: "text" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const code = typeof credentials?.code === "string" ? credentials.code : "";

        if (!isValidEmail(email) || code.length === 0) {
          return null;
        }

        try {
          await verifyOtp(email, code);
        } catch (error) {
          if (
            error instanceof OtpInvalidError ||
            error instanceof OtpExpiredError ||
            error instanceof OtpTooManyAttemptsError
          ) {
            return null;
          }
          throw error;
        }

        // Identidade mínima aqui — o upsert de verdade (e o id definitivo
        // do nosso banco) acontece uma única vez no callback `jwt` abaixo,
        // igual para este provider e para o Google.
        const normalizedEmail = normalizeEmail(email);
        return { id: normalizedEmail, email: normalizedEmail };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.email) {
        const isGoogle = account?.provider === "google";
        const appUser = await upsertUserByEmail(
          user.email,
          isGoogle
            ? {
                name: user.name ?? null,
                avatarUrl: user.image ?? null,
                googleId: account?.providerAccountId ?? null,
              }
            : undefined,
        );
        token.userId = appUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
