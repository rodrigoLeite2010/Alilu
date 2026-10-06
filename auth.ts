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
import { isEmailDisabled, isUserDisabled } from "@/lib/auth/user-status";

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
    // Conta desativada pelo admin não entra (Google nem código por e-mail).
    async signIn({ user }) {
      if (user?.email && (await isEmailDisabled(user.email))) return false;
      return true;
    },
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
        // Sempre a partir do registro no banco (não do token bruto do
        // provider) — é o mesmo valor que o resto do site (ex.: header,
        // /minha-conta) vê ao consultar getUserById, e cobre também o
        // login por código de e-mail, que não tem nome/foto do provider.
        token.name = appUser.name ?? undefined;
        token.picture = appUser.avatarUrl ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      // Sessão já aberta de uma conta desativada: vira "sem login" em todo o site.
      if (token.userId && (await isUserDisabled(token.userId))) {
        return { expires: session.expires } as unknown as typeof session;
      }
      if (session.user && token.userId) {
        session.user.id = token.userId;
        session.user.name = token.name ?? null;
        session.user.image = token.picture ?? null;
      }
      return session;
    },
  },
});
