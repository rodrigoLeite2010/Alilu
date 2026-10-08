# Amigo Secreto

Módulo privado (login obrigatório) em `/amigo-secreto`. Migration: `db/migrations/0042_secret_santa.sql`.

## Camadas
- `lib/secret-santa/draw.ts` — algoritmo puro do sorteio (emparelhamento perfeito em grafo bipartido, Kuhn + permutação CSPRNG).
- `lib/secret-santa/backend/repository.ts` — SQL (cada operação composta é UM comando atômico).
- `lib/secret-santa/backend/service.ts` — regras, autorização e DTOs filtrados por papel.
- `app/api/secret-santa/**` — rotas finas (`route()` injeta o userId da sessão).
- `app/amigo-secreto/**`, `components/secret-santa/**` — telas mobile-first.

## Privacidade (backend)
- Só participantes aceitos acessam um grupo; os demais recebem 404.
- `getMyAssignment` devolve apenas a pessoa que o usuário tirou. Não existe endpoint que liste o sorteio, exceto `/reveal` (após revelação ou, p/ organizador, se `allow_owner_see_draw`).
- Conversa anônima: mensagens ligadas a uma atribuição ativa e guardam só `from_giver`; o DTO é `{id, mine, body, createdAt}`.
- Presente escolhido e “comprado” são privados de quem tirou. Auditoria nunca grava o resultado.

## Operação
- Rodar `npm run db:migrate` (0042).
- Não há e-mail no MVP: convites por link (WhatsApp/copiar/QR) e notificações internas.
- Sem tempo real: o chat atualiza a cada 30 s.
