# Destinos sociais explícitos — correção de publicações em contas não autorizadas

Data: 18/11/2026 · Base: `51a3cbb` (main) · Migração nova: `0058_social_destination_authorization.sql`

## 1. Sintoma

Conteúdo do **Se Tá Bom Pra Você** aparecia também no Facebook, fora dos destinos que a pessoa escolheu.

## 2. Causa raiz (rastreada no código, não presumida)

### A. Chamada do Alilu à API do Facebook sem escolha explícita — CONFIRMADA

`content_automations.facebook_page_ids` nasceu (migração 0054) com a semântica:

| valor | comportamento antigo |
|---|---|
| `NULL` (padrão de **toda** automação, inclusive as antigas) | **"Automático"**: grava como destino toda Página **conectada** vinculada (pela Meta) à conta Instagram da automação |
| `{}` | não publica no Facebook |
| `[ids]` | essas Páginas |

Caminho executado:

```
cron /api/cron/content-automation
 → content-automation-cron.ts (cria a publicação Instagram)
 → automation-facebook.ts attachAutomationFacebookDestinations
 → social-destinations-service.ts attachAutomaticFacebookDestinations(facebookPageIds = null)
 → facebook-page-repository.ts listConnectedPagesForInstagramAccount(...)   ← inferência pelo vínculo IG↔Página
 → social_publication_destinations (status SCHEDULED)
cron /api/cron/instagram-publish
 → runFacebookScheduler → publishFacebookDestination → Pages API
```

Ou seja: bastava a Página ligada ao Instagram do Se Tá Bom Pra Você estar conectada no Alilu (o login Meta conecta as Páginas que a pessoa administra) para os posts do Piloto Automático saírem nela — sem ninguém marcar "Facebook".

Outros pontos de inferência também corrigidos:

- **Seletor da tela de criação**: ao marcar "Facebook" com uma única Página conectada, ela era escolhida sozinha (sem filtro por conta Instagram).
- **Painel do Piloto**: oferecia "Automático — Página vinculada a esta conta" como opção padrão.
- Nenhuma validação no servidor impedia usar uma Página ligada a **outra** conta Instagram (ex.: Página Alilu numa publicação do GTA 6).

### B. Cron/webhook/rotina duplicando — NÃO encontrada

O Instagram nunca chama o serviço do Facebook (`instagram-publish-service.ts` / `meta-graph-client.ts` só falam com o Instagram; `share_to_feed` é o feed do **Instagram**). Os dois agendadores usam claim atômico e a constraint única `(post_id, platform, external_account_id)`. Não há webhook de repostagem nem repostagem para o Facebook.

### C. Compartilhamento da Central de Contas da Meta — PROVÁVEL para o **perfil pessoal**

O Alilu **não tem nenhuma chamada** que publique em perfil pessoal (somente `/{page-id}/photos`, `/{page-id}/feed`, `/{page-id}/video_reels` com token **de Página**; publicar em perfil pessoal pela API não é possível desde 2018). Se o post aparece no **perfil pessoal**, ele chegou lá pela opção da Meta "Compartilhar no Facebook" automática entre perfis (Central de Contas), que o Alilu não controla.

### D. Combinação — provável

A + C: o modo Automático explica posts em **Páginas**; a Central de Contas explica posts no **perfil pessoal**. Para separar os casos com os dados reais, rode a auditoria (seção 6): todo post no Facebook que **não** aparece em `publicados_pelo_alilu_no_facebook` não foi enviado pelo Alilu.

## 3. O que mudou

### Regra única (`lib/facebook/destination-policy.ts`)

Um destino Facebook só é aceito se:

1. a Página existe, é do mesmo usuário e o id externo gravado é o mesmo da Página;
2. **com perfil da conta** ("categoria"): Facebook ativo **e** Página na lista de permitidas;
3. **sem perfil** (contas ainda não configuradas): foi escolhido explicitamente, **não** veio do antigo modo Automático e a Página **não** está vinculada a outra conta Instagram.

Nunca há substituição: Página negada não vira outra Página, nem "a primeira", nem o perfil pessoal.

### Onde a regra é aplicada

| Etapa | Arquivo |
|---|---|
| Criar/editar publicação (POST/PATCH) | `social-destinations-service.ts` (`applyFacebookDestinations`, `assertFacebookDestinationsAllowedForPost`), `app/api/instagram/posts/[id]/route.ts` |
| Piloto Automático | `attachAutomaticFacebookDestinations` (null ⇒ só Instagram), `automation-service.ts updateAutomationFacebookPages` (null recusado) |
| Filas de vídeo / Radar Viral (lote) | `queue-service.ts assertDestinations`, `queue-planner.ts checkTargets` |
| **Imediatamente antes da API** (cron, "Publicar agora", "Tentar novamente") | `facebook-publish-service.ts publishFacebookDestination` → `authorizeAtPublishTime` |

Negado na hora da publicação ⇒ destino `CANCELLED` com `last_error_reason = unauthorized_destination`, tentativa `blocked` com `api_called = false`, **nenhuma** chamada à Meta. O Instagram da mesma publicação não é tocado.

### Configuração por categoria (perfil de destinos por conta Instagram)

Tabela `social_destination_profiles` (por ID, nunca por nome): `facebook_enabled`, `allowed_facebook_page_refs`, `default_facebook_page_refs` (⊆ permitidas, garantido por constraint). Tela: **Painel do Instagram → "Destinos por conta do Instagram"**. API: `GET/PUT /api/social/destination-profiles`. Conectar uma Página nova não habilita nada.

### Tela de criação

- Só mostra as Páginas permitidas para a conta; com Facebook desativado o checkbox fica bloqueado com explicação.
- Sugestão inicial = destinos padrão da conta (editável); nunca escolhe uma Página sozinho.
- Bloco **"Esta publicação será enviada para: Instagram: … / Facebook: …"** sempre visível.
- Calendário/histórico: cada post mostra Instagram e "Facebook: não selecionado" ou o status real de cada Página (incl. "Bloqueado — destino não autorizado").

### Auditoria

- `social_publication_destinations.selection_source` (`manual`, `automation`, `video_queue`, `legacy`, `automation_auto_legacy`). A migração classifica os destinos existentes (somente metadado, status intacto).
- `social_publication_attempts` ganhou `execution_id`, `instagram_account_id`, `facebook_page_ref`, `external_account_id`, `selection_source`, `api_called` e o resultado `blocked`.
- Logs JSON (`publication-log.ts`, lista fechada de campos, sem tokens): `facebook.destinations.selected`, `facebook.destination.rejected`, `facebook.automation.not_configured`, `facebook.publish.start|done|blocked|failed` com conta, Página, origem, execução e id publicado.

### Idempotência (já existente, agora coberta por testes)

Constraint única por publicação+plataforma+conta; claim atômico com lock (= id da execução); POST não idempotente marcado antes do envio e reconciliado; falha numa rede nunca reenvia a outra; token expirado marca a **mesma** Página para reconectar.

## 4. Arquivos

Novos: `db/migrations/0058_social_destination_authorization.sql`, `lib/facebook/destination-policy.ts`, `lib/facebook/backend/destination-authorization.ts`, `lib/facebook/backend/destination-profile-repository.ts`, `app/api/social/destination-profiles/route.ts`, `components/instagram/SocialDestinationProfilesSection.tsx`, `scripts/social-destinations-audit.ts`, `__tests__/lib/social-destination-authorization.test.ts`, `__tests__/lib/destination-policy.test.ts`, este relatório.

Alterados: `lib/facebook/backend/facebook-publish-service.ts`, `social-destination-repository.ts`, `social-destinations-service.ts`, `facebook-page-repository.ts` (removida `listConnectedPagesForInstagramAccount`), `lib/facebook/destination-view.ts`, `lib/instagram/backend/publication-log.ts`, `lib/content-automation/backend/automation-service.ts`, `automation-facebook.ts`, `lib/video-queue/backend/queue-service.ts`, `queue-planner.ts`, `app/api/instagram/posts/[id]/route.ts`, `app/instagram/painel/page.tsx`, `components/instagram/SocialDestinationsPicker.tsx`, `PublicationComposerPanel.tsx`, `CarouselPublishPanel.tsx`, `ReelsComposer.tsx`, `CalendarPostCard.tsx`, `PublicationDestinationsStatus.tsx`, `content-automation/AutomationFacebookPanel.tsx`, testes existentes do Piloto/seletor/painel ajustados à regra nova.

## 5. Impacto em agendamentos existentes

- Destinos criados pelo antigo modo Automático (`automation_auto_legacy`) **não saem** enquanto a conta não tiver perfil autorizando explicitamente aquela Página.
- Destinos manuais antigos (`legacy`) continuam válidos se a Página não for de outra conta Instagram e o perfil (se existir) permitir — os agendamentos corretos (ex.: Alilu → Página Alilu) são preservados.
- Instagram nunca é cancelado por esta correção; nada publicado é apagado; nada de outras tabelas muda.
- **Atenção**: automações com `facebook_page_ids NULL` que publicavam corretamente na Página (ex.: Piloto do Alilu → Página Alilu) passam a publicar só no Instagram até você marcar a Página na automação. Isso é intencional (regra "somente quando ambos estiverem selecionados"). A auditoria lista exatamente quais automações estão nessa situação.

## 6. Ativação em produção (nada foi feito automaticamente)

1. Revisar e aplicar o patch numa branch; rodar `npm test` e `npm run build`.
2. Rodar a auditoria **somente leitura** contra produção: `npx tsx scripts/social-destinations-audit.ts --user <seu e-mail>`.
3. `npm run db:migrate` (aplica a 0058 — aditiva).
4. Deploy.
5. No Painel do Instagram → **Destinos por conta do Instagram**:
   - Alilu: permitir Facebook → Página Alilu (marcar por padrão).
   - Prestador Seguro: permitir Facebook → Página Prestador Seguro.
   - Se Tá Bom Pra Você: **Facebook desativado**.
   - GTA 6: Facebook desativado (até existir a Página GTA 6; então permitir só ela).
6. Nas automações do Piloto que devem ir ao Facebook, escolher a Página explicitamente.
7. (Opcional, com autorização) `--apply --i-have-authorization` para antecipar o bloqueio dos pendentes negados (o agendador já os bloqueia de qualquer forma).
8. Central de Contas da Meta (ver seção 7).

## 7. Central de Contas da Meta (fora do controle do Alilu)

Se o post aparece no **perfil pessoal** do Facebook, desative o compartilhamento automático:

- **Instagram (app)** → perfil do Se Tá Bom Pra Você → menu ☰ → **Central de Contas** → **Compartilhamento entre perfis** → escolha a conta do Instagram → **Compartilhar em: Facebook** → desative o compartilhamento automático de publicações, Reels e stories.
- **Facebook** → Configurações e privacidade → Configurações → **Central de Contas** → **Compartilhamento entre perfis** → mesma opção.
- Repita para cada conta Instagram que não deve ir ao Facebook. Também confira a opção de recomendar Reels no Facebook nas configurações de Reels do Instagram.
