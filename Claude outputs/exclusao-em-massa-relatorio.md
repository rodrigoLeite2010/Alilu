# Exclusão em massa (Bulk Delete) — relatório

## 1. Módulos atualizados

| Módulo / tela | Endpoint novo | Observações de regra de negócio |
|---|---|---|
| Instagram — Minhas publicações (histórico, rascunhos, agendadas, falhas, canceladas) | `POST /api/instagram/posts/bulk-delete` | Remove só do Alilu. Publicadas continuam no Instagram. Agendadas são **canceladas antes** de excluir. Em processamento (PROCESSING) são recusadas e o checkbox fica desabilitado. |
| Piloto Automático — automações | `POST /api/content-automation/automations/bulk-delete` | Confere a posse, cancela execuções pendentes e então exclui. |
| Carrosséis (Carrossel Inteligente) | `POST /api/carousel/projects/bulk-delete` | Mesma regra da individual: publicado/em publicação é mantido e explicado. |
| Vídeos com IA (histórico) | `POST /api/ai-video/generations/bulk-delete` | Apaga o MP4 do Blob. Em andamento não seleciona. Não devolve créditos. |
| Histórico de importações do Instagram | `POST /api/videos/instagram-import/bulk-delete` | Registro + arquivo no Blob. |
| Histórico de vídeos do YouTube | `POST /api/videos/youtube-import/bulk-delete` | Só concluídas (as únicas com "Excluir" individual). |
| Minhas mídias (3 seções) | reutiliza `content-automation/media/bulk-delete` (já existia) + os dois de vídeo/importação acima | Cada seção tem seleção própria. Mídia usada em publicação/automação é mantida com o motivo. |
| Finanças — receitas e despesas | `POST /api/financas/entries/bulk-delete` | Recorrentes saem com todas as repetições (aviso na confirmação). |
| Loterias — Meus jogos | `POST /api/loterias/apostas/bulk-delete` | Apostas saem com os jogos (cascata existente). |
| Agenda — visão Lista | `POST /api/agenda/events/bulk-delete` | Cancela lembretes pendentes e faz o soft delete (mesma rotina da individual). Seleção por compromisso (recorrente = 1 item). |

## 2. Componentes reutilizáveis criados

- `components/bulk/useBulkSelection.ts` — seleção com escopo (filtro) e visíveis; descarta o que sai do filtro; "selecionar todos os N do filtro".
- `components/bulk/BulkCheckbox.tsx` — checkbox com área de toque de 44 px e estado parcial.
- `components/bulk/BulkActionBar.tsx` — Selecionar todos, contador, Desmarcar todos, "Excluir selecionados (N)" (desabilitado sem seleção). Barra fixa no topo da lista.
- `components/bulk/BulkDeleteDialog.tsx` (`useBulkDelete`) — confirmação → barra de progresso → resumo com falhas por item.
- `lib/bulk-delete/core.ts` — validação/deduplicação de ids, execução com concorrência limitada, falhas parciais, `BulkNotFoundError` (idempotência).
- `lib/bulk-delete/server.ts` — `createBulkDeleteHandler`: autenticação, userId sempre da sessão, log de auditoria sem dados pessoais.
- `lib/bulk-delete/client.ts` — envio em lotes de 25, uma nova tentativa em falha de rede/5xx, parada em 401, mensagem final.
- `lib/ai-video/backend/generation-delete-service.ts` — a lógica de "Excluir vídeo" foi extraída para um serviço, usado agora pela rota individual e pela em massa (sem duplicar código).

## 3. Endpoints

Novos: os 9 listados na tabela acima. Modificado: `DELETE /api/ai-video/generations/[id]` (só passou a usar o serviço extraído; comportamento idêntico). Limite de 200 ids por requisição; o cliente envia lotes de 25.

## 4. Testes realizados

Novos (31 testes): núcleo (deduplicação, ordem, concorrência, falha parcial, erro inesperado sem vazar detalhes, idempotência), cliente (lotes, progresso, retry de rede, 401, falha parcial, compatibilidade com o formato `kept`), endpoints (401, corpo inválido, cancelamento antes da exclusão de agendadas, PROCESSING recusado, id de outro usuário nunca é apagado, userId do corpo ignorado, log de auditoria) e a tela de publicações (botão desabilitado, contador, selecionar todos ignorando PROCESSING, filtro descarta seleção, confirmação, falha parcial, falha de rede, cancelar sem chamar o servidor).

Regressão: testes dos componentes e rotas que tocam os arquivos alterados (92 testes), 65 testes de componentes da suíte geral, `eslint` nos arquivos alterados e `tsc --noEmit` sem erros novos. Os testes rodaram numa cópia de trabalho isolada (o `node_modules` da pasta é do Windows); nenhuma exclusão real foi feita e nenhum dado de produção foi tocado.

## 5. Limitações

- **Layout em celular e desktop não foi testado em navegador real.** Foi construído com classes responsivas (alvos de toque de 44 px, barra que quebra linha, diálogo como folha inferior no celular), mas falta uma conferência visual.
- A suíte completa não rodou até o fim: os testes de Amigo Secreto (banco PGlite) são lentos e estouraram o tempo da sessão. Esses testes não tocam nenhum arquivo alterado.
- O processamento é síncrono por lote (até 25 itens por requisição, 5 em paralelo). Não foi criado processamento assíncrono em fila: para os volumes atuais (listas de até algumas centenas) o progresso por lote resolve. "Selecionar todos os resultados do filtro" funciona sobre o que já está carregado na tela, pois todas as listas atuais carregam tudo no cliente.
- Excluir de uma publicação já feita **não** apaga no Instagram (de propósito); não existe funcionalidade de apagar no Instagram.
- A auditoria é um log estruturado (`event: bulk_delete`, módulo, userId, quantidades). Não há tabela de auditoria no projeto.
- Se uma resposta se perder na rede e o lote for reenviado, itens já excluídos contam como excluídos (idempotente). Por isso um id inexistente ou de outro usuário também aparece como "excluído" na contagem, sem apagar nada de ninguém.

## 6. Pendências para revisão

1. Conferir visualmente no celular e no desktop (Minhas publicações, Minhas mídias, Agenda em lista).
2. Decidir se o `MediaPicker` (Piloto Automático) deve migrar para os componentes novos; foi mantido como estava porque já tinha exclusão em massa própria e testada.
3. Módulos com exclusão individual **não** cobertos, por serem pequenos ou terem regras próprias que pedem decisão: metas, dívidas, limites, envelopes e assinaturas (Finanças), jogos avulsos dentro de uma aposta, imagens de marca (end media / Story brand), desejos e restrições do Amigo Secreto, desconectar conta do Instagram.
4. Nada foi commitado nem publicado: as alterações estão na pasta do projeto, prontas para revisar com `git diff` e fazer o deploy quando quiser.
