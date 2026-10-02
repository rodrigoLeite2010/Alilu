# Armazenamento: excluir mídias e limpeza automática do Vercel Blob

Um arquivo no Vercel Blob **só some quando alguém o apaga**. Apagar a linha no banco não basta. Este módulo cuida disso de duas formas:

1. **"Excluir mídia"**: o usuário apaga o arquivo de verdade.
2. **Limpeza automática** de temporários, órfãos e vencidos, com modo simulação.

## 1. Excluir mídia (usuário)

| Onde | O que apaga |
|---|---|
| **Minha conta › Minhas mídias** (`/minha-conta/midias`) | Tudo o que o usuário guardou: biblioteca do Instagram (`instagram_media`), vídeos com IA e importações do Instagram. Mostra tamanho, data e vencimento, com os botões **Baixar** e **Excluir mídia**. |
| Imagem para vídeo IA › histórico | **Excluir vídeo**: `DELETE /api/ai-video/generations/{id}`. Apaga o MP4 e tira o vídeo do histórico (`user_deleted_at`). A linha fica para o extrato e as métricas. Não vale para vídeos em andamento e não devolve créditos. |
| Importações do Instagram | **Excluir**: apaga o registro e o arquivo. |
| Biblioteca (Piloto Automático) | Botão já existente (`DELETE /api/content-automation/media/{id}`). |

Uma mídia já usada em publicação, ou definida como padrão de alguma automação, **não pode** ser excluída, e a tela explica o motivo. Nesses casos o arquivo é necessário para o histórico e para a automação.

## 2. Limpeza automática

Fica em `lib/storage-cleanup/backend/cleanup-service.ts`. Roda pelo cron diário e também pelo admin, em `/admin/armazenamento`.

| Pasta | Regra | Prazo padrão |
|---|---|---|
| `videos/uploads/` | Entradas do Split-Screen que ficaram para trás (o normal é apagar logo após processar) | 24 h |
| `videos/outputs/` | Vídeo gerado no Split-Screen (não tem registro no banco; para publicar, o editor já envia uma cópia à biblioteca) | 3 dias |
| `videos/imports/` | Importações do Instagram vencidas (o status vira `EXPIRED`) | 7 dias |
| `videos/imports/` | Upload manual nunca registrado (órfão) | 24 h |
| `instagram-media/` | **Só órfãos**: arquivo sem linha em `instagram_media` e que não é áudio da conta nem de post | 24 h |
| `ai-video/{u}/input/` | Imagem ou logo sem uso em rascunho, geração em andamento ou geração recente | 30 dias |
| `ai-video/{u}/generated/` | MP4 sem registro. Os registrados já têm retenção própria: 7 dias sem compra, 30 com compra | 24 h |

Proteções:

- **Modo simulação ligado de início** (`dry_run = true`): a limpeza só relata o que apagaria, com a quantidade de arquivos e o espaço.
  1. Confira o relatório em `/admin/armazenamento`.
  2. Desmarque "Modo simulação" e salve.
  3. A partir daí a limpeza apaga de verdade.
- **Apenas os prefixos listados** são varridos. Nada referenciado no banco é apagado pelas regras de órfãos.
- **Prazos de carência** protegem uploads que ainda estão sendo registrados.
- **Limite de exclusões por execução** (`max_deletes_per_run`, padrão 500) e orçamento de 45 s. Se parar pelo tempo, a execução seguinte continua de onde parou.
- **Histórico** em `storage_cleanup_runs`: quantos arquivos foram vistos, quantos eram elegíveis e quantos foram apagados, o espaço por regra e o uso atual por pasta.

## Configuração

1. `npm run db:migrate`, que aplica a migração `0023_storage_cleanup.sql`.
2. No cron externo (cron-job.org), crie uma tarefa **1× por dia**: `GET https://alilu.com.br/api/cron/storage-cleanup`, com o cabeçalho `Authorization: Bearer <segredo>`. O segredo é o mesmo do cron do Instagram, ou `STORAGE_CLEANUP_CRON_SECRET`.
3. Em `/admin/armazenamento`:
   1. Clique em **Simular agora** e confira o relatório.
   2. Desmarque a simulação e salve.
   3. Se quiser liberar espaço na hora, clique em **Limpar agora**.

Também dá para apagar manualmente no painel da Vercel: **Storage › (seu Blob Store) › Browser**. Mas nunca apague por lá arquivos de `instagram-media/` que estejam em uso.

## Testes

`__tests__/lib/storage-cleanup.test.ts`: simulação, cada regra (apaga o que deve e preserva o que está em uso: mídia, áudio, rascunho, geração ativa, logo de overlay, vídeo registrado, importação recente), vencimento das importações, limite por execução, cron desligado e "Excluir vídeo" (só terminado, só do dono, sai do histórico).
