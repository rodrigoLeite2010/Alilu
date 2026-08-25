# Módulo: auth

> Implementado na **Etapa 03**, junto com o módulo Identity do backend.
> Autenticação completa: cadastro, login, sessão persistida (refresh
> token), logout e renovação automática de token. Corresponde ao módulo
> backend `Identity`.

## Estrutura

```
auth/
├── AuthProvider.tsx   # dono do estado de autenticação (useAuth())
├── api.ts             # chamadas HTTP cruas (POST /api/auth/...)
├── schemas.ts          # validação (zod) dos formulários de login/cadastro/recuperação
├── types.ts            # tipos espelhando os DTOs do backend
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   └── ForgotPasswordScreen.tsx
└── index.ts            # barrel — as rotas em src/app só importam daqui
```

## O que NÃO está aqui (de propósito)

- Nenhum vínculo entre o usuário autenticado e um condomínio/unidade —
  isso pertence ao módulo `resident` (futuro). Um usuário autenticado por
  este módulo pode não ter nenhum condomínio associado ainda.
- Recuperação de senha por e-mail: a tela existe e valida o e-mail, mas o
  backend só tem a porta preparada (`IEmailSender`/`NoOpEmailSender`), sem
  envio real — a tela é honesta sobre isso (ver `ForgotPasswordScreen.tsx`).

## Como a sessão funciona

- O **access token** vive só em memória (`services/authTokenStore.ts`) —
  nunca é persistido, e some quando o app é fechado.
- O **refresh token** é salvo no Expo Secure Store, e é o que permite
  restaurar a sessão quando o app abre de novo (`AuthProvider` faz esse
  bootstrap automaticamente).
- `services/api.ts` anexa o access token em toda chamada e, ao receber um
  401, tenta renovar a sessão uma vez (via refresh token) antes de repetir
  a chamada original; se a renovação falhar, a sessão é encerrada
  localmente (equivalente a um logout).
