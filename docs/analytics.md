# Analytics (PostHog Cloud)

Fonte única dos números de acesso é o PostHog. O PostgreSQL **não** guarda pageviews.

## Fluxo
- `components/analytics/PostHogProvider.tsx` (layout raiz) → `lib/analytics/posthog-client.ts`: `$pageview` a cada rota (só pathname, sem query), `user_login`, `user_logout`. Sem autocapture, sem gravação de sessão.
- Só envia em **produção**, com `NEXT_PUBLIC_POSTHOG_KEY` e fora de localhost/IP local. Todo evento leva `environment = production` e `logged_in`.
- Usuário logado: `identify(<id interno>)` (nunca e-mail/CPF). Logout: `user_logout` + `reset()`.
- Admin: `/admin/acessos` ← `/api/admin/analytics/{summary,pages,recent}` (só `ADMIN_EMAILS`), consulta HogQL no servidor, cache de 30–60 s.
- "Online agora" = pessoas com evento nos últimos 5 minutos.

## Variáveis
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY` (servidor), `POSTHOG_PROJECT_ID` (servidor), `POSTHOG_API_HOST` (opcional).

## Painel do PostHog
1. Crie o projeto (Cloud US ou EU). Em Project settings: **Project API key** (`phc_…`) e **Project ID** (número).
2. Project settings → **Timezone**: `America/Sao_Paulo` ("hoje" usa o fuso do projeto).
3. Project settings → ative **Discard client IP data** (o admin não mostra IP).
4. Personal API keys → crie uma chave com escopo **Query: read** (apenas) → `POSTHOG_PERSONAL_API_KEY`.
5. Configure as variáveis na Vercel e faça redeploy.

## Privacidade
`/privacidade` descreve o uso do PostHog (cookie/armazenamento local anônimo). Para público brasileiro (LGPD) com analytics de audiência sem publicidade, o aviso na política costuma bastar; banner de consentimento só se passar a usar rastreamento para publicidade/perfilamento — confirme com seu jurídico.
