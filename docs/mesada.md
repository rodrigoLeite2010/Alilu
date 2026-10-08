# Mesada

Módulo privado (login) para pais/responsáveis: crianças, mesada mensal, gastos, entradas, cofrinho, metas, tarefas com ou sem recompensa, categorias, histórico e resumo mensal.

## Regras de ouro
- **Saldo nunca é gravado.** Tudo sai de `allowance_transactions` (livro-razão): disponível = entradas + retiradas do cofrinho − gastos − guardado; cofrinho = guardado − retiradas. Meta = guardado vinculado a ela.
- **Dinheiro em centavos inteiros** (`amount_cents`), nunca float.
- **Cada operação financeira é UM comando SQL atômico** (o driver HTTP do Neon não tem BEGIN/COMMIT): a checagem de saldo e o lançamento acontecem juntos; aprovar recompensa = marcar a conclusão + lançar a entrada no mesmo comando.
- **Idempotência**: índice único `(child_id, source_type, reference_id)` — mesada = `<plano>:<ano-mês>`, recompensa = id da conclusão. Cron repetido, abas simultâneas ou duplo clique nunca duplicam.
- **Segurança**: o `userId` vem sempre da sessão; toda criança/meta/tarefa/conclusão é conferida contra o dono; outro usuário recebe 404.
- Nada de histórico é apagado: categorias só são desativadas; "não acumular saldo" gera um lançamento de ajuste de fechamento.

## Mesada automática
- `GET|POST /api/cron/allowance` com `Authorization: Bearer <ALLOWANCE_CRON_SECRET | CRON_SECRET | AGENDA_CRON_SECRET>`; agende **1x por dia** (ex.: 06:00) no mesmo cron externo da Agenda.
- Além do cron, a mesada devida é lançada ao abrir `/mesada` (recuperação de até 12 meses, idempotente).
- Fuso: America/Sao_Paulo. Dia 31 em meses curtos vale o último dia do mês.

## Rotas
Telas: `/mesada`, `/mesada/{id}` (Resumo, Histórico, Metas, Tarefas), `/mesada/categorias`.
API: `/api/allowance/children[/{id}[/plan|expenses|income|savings/deposit|savings/withdraw|transactions|goals[/{goalId}]|tasks[/{taskId}[/complete]]]]`, `/api/allowance/completions/{id}/approve|reject`, `/api/allowance/categories[/{id}]`.

## Migration
`db/migrations/0041_allowance_mesada.sql` (`npm run db:migrate`). Cria as tabelas e as categorias padrão do sistema.

## Limitações conhecidas
- Dois gastos simultâneos podem ultrapassar o saldo por milissegundos (sem transação interativa); cada um é checado contra o saldo no momento do comando.
- Avatar: emoji; upload de imagem não incluído nesta versão.
