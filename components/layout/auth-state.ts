export interface HeaderUser {
  name: string | null;
  email: string;
  image: string | null;
  isAdmin?: boolean;
}

/**
 * Estado de autenticação do cabeçalho, resolvido no navegador (ver
 * useHeaderAuth). "loading" existe para nunca mostrar "Entrar" e trocar
 * bruscamente para o avatar um instante depois (PROMPT auth, Fase 4).
 */
export type HeaderAuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: HeaderUser };
