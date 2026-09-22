import type { DefaultSession } from "next-auth";

/**
 * Estende os tipos do NextAuth (Auth.js) para carregar o id do usuário no
 * nosso próprio banco (users.id) — preenchido no callback `jwt` em auth.ts
 * e exposto em `session.user.id` pelo callback `session`.
 *
 * O NextAuth v5 (`next-auth/jwt`) só reexporta `@auth/core/jwt` — para o
 * merge de tipos funcionar de verdade (é `@auth/core/jwt` que declara a
 * interface `JWT` usada pelos callbacks internamente), a augmentation
 * precisa mirar o módulo `@auth/core/jwt`, não `next-auth/jwt`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
  }
}
