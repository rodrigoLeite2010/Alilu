# Plano de deploy e rollback — importador de imóveis de parceiros

Nada abaixo foi executado em produção. Publicação depende de aprovação.

## Pré-requisitos

- Variáveis já existentes: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTH_SECRET`, `ADMIN_EMAILS`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (**não trocar** — também cifra tokens dos feeds), segredo de cron (`STORAGE_CLEANUP_CRON_SECRET`, `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET`, ≥ 16 caracteres).
- Nenhuma dependência nova. `saxes` já está no `package-lock.json` (dependência transitiva do jsdom) e é usado diretamente pelo parser XML; recomenda-se declará-lo em `dependencies` com `npm install saxes@6.0.0 --save-exact` **no Windows** (não rodar `npm install` a partir de outro sistema operacional sobre o mesmo `node_modules`).

## Homologação

1. Branch de banco Neon de homologação com as migrações até 0049 aplicadas.
2. Conferir pendências: `npm run db:migrate` aplica **todas** as pendentes — revisar a lista; deve incluir somente `0050_imoveis_integracoes.sql` (e outras já planejadas).
3. Aplicar e conferir: `select count(*) from property_partners;` (0) e que `properties`, `property_images` mantêm contagens.
4. Validar localmente:
   ```powershell
   npx vitest run __tests__/lib/imoveis-integracoes.test.ts __tests__/lib/imoveis-integracoes-parsers.test.ts __tests__/lib/imoveis-integracoes-ssrf.test.ts __tests__/components/ImoveisIntegracoes.test.tsx
   npx vitest run __tests__/lib/imoveis.test.ts __tests__/components/Imoveis.test.tsx __tests__/seo/seo-rules.test.ts __tests__/lib/admin-links.test.ts
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
5. Deploy de preview apontando para o banco de homologação.
6. Teste de ponta a ponta com conta admin: cadastrar parceiro fictício (domínio de fotos de teste), importar `MODELO_IMPORTACAO_IMOVEIS.xlsx`, revisar prévia, importar sem publicar, aprovar um item, conferir busca/página/WhatsApp/"Ver anúncio original", suspender e reativar o parceiro.
7. Conferir que um anúncio direto pré-existente continua idêntico (status, URL, fotos, contato, sitemap).
8. Agendar `GET /api/cron/imoveis-integracoes` (Authorization: Bearer) a cada 30 min no preview e observar 2–3 execuções.

## Produção

1. Backup/branch do Neon antes da migração.
2. Aplicar somente a migração 0050 (aditiva).
3. Publicar o código.
4. Smoke: `/imoveis` e um anúncio direto (200), `/admin/imoveis/integracoes` (404 anônimo; painel para admin), `GET /api/imoveis/integracoes/painel` (403 anônimo), `GET /api/cron/imoveis-integracoes` sem Bearer (401), `robots.txt` com `/imoveis/saida/`.
5. Agendar o cron (Vercel Cron no plano que permitir a frequência, ou agendador externo).
6. Primeiro parceiro real: seguir `CHECKLIST_INTEGRACAO_PARCEIROS.md`, começando por upload manual, sem publicação automática.

## Rollback

Ordem do menos ao mais invasivo — **sem rollback destrutivo automático**:

1. Suspender o parceiro no painel (oculta instantaneamente todos os seus anúncios).
2. Desativar as fontes / remover o agendamento do cron.
3. Reverter o deploy do código. Os anúncios importados continuam em `properties` com dono técnico; para ocultá-los sem código novo: `insert into property_advertisers(user_id,suspended) select user_id,true from property_partners on conflict(user_id) do update set suspended=true;`
4. As tabelas novas podem permanecer (não são lidas pelo código antigo). Remover dados apenas após decisão de retenção, com backup, e na ordem: suspender → `transition` para `removed` via admin → limpar tabelas da integração.
5. Não reverter a migração com `drop` enquanto houver anúncios importados vinculados.

## Monitoramento pós-deploy

- Painel → Logs e erros (falhas de feed, guardas de ausência, cópia de fotos).
- Painel → Prévias e sincronizações (lotes falhos/pendentes).
- Uso de Functions e Blob no painel da Vercel.
