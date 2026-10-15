# Auditoria de funcionalidade, experiência e privacidade — 15/10/2026

## Alcance e limites

Inspeção por código do catálogo, registro de componentes, conteúdo de ferramentas, processamento local de PDF/Office, rede, analytics, diálogos e testes. O catálogo contém 125 ferramentas, todas com status ativo; 106 componentes são registrados diretamente e 19 ferramentas Base64 por configuração. As 19 ferramentas Base64 também possuem conteúdo específico separado. Não foram identificados componentes ausentes ou ferramentas em breve no catálogo atual. O fallback `ComingSoonNotice` continua como proteção para cadastros futuros e não comprova uma página atualmente incompleta.

Esta inspeção não mede Core Web Vitals reais nem comprova renderização visual em todos os dispositivos. LCP, INP e CLS de campo dependem de dados da versão publicada (CrUX/Search Console) e experiência real. Não foram lidos arquivos `.env`.

## Falhas comprovadas e corrigidas

| Prioridade | URL/área | Evidência e impacto | Correção |
| --- | --- | --- | --- |
| P1 | `/utilitarios/geradores/gerador-numeros-aleatorios` | Intervalo válido de até um bilhão com repetição desabilitada construía um array com todos os números e outro array de trabalho. Podia esgotar a memória ou congelar a aba. | Amostragem criptográfica em intervalo virtual com memória proporcional apenas ao lote; preserva resultados distintos e os limites existentes. Limites sem precisão inteira segura são rejeitados. |
| P2 | `/utilitarios/geradores/sorteador-numeros` | Mesmo padrão de alocação do intervalo, até um milhão. | Reutiliza amostragem virtual. |
| P2 | Geradores que usam `secureRandomInt` | Rejection sampling aceitava a borda `limit`, produzindo viés residual na distribuição. | Limite calculado sobre 2^32 possibilidades e rejeição com `>=`; não usa `Math.random`. |
| P1 | `/amigo-secreto/convite/[token]` e navegação seguinte | Analytics removia query/hash, mas enviava o token de convite no pathname e URLs de referência, quando PostHog está habilitado em produção. | Mascara a credencial em pageviews e propriedades automáticas de URL/path/referrer. Nenhuma mudança em autenticação, autorização ou aceitação dos convites. |
| P2 | Modais genéricos e Instagram | `aria-modal` estava presente sem retenção de Tab/Shift+Tab; teclado podia sair para controles atrás da sobreposição. | Circula o foco entre primeiro e último controle habilitado, preservando Escape, foco inicial, devolução do foco e estabilidade durante digitação. |
| P2 | `/utilitarios/financeiro/dias-uteis` | 20 de novembro era descontado mesmo em anos anteriores à instituição do feriado nacional. | Incluído apenas a partir de 2024, com teste histórico de 20/11/2023 e 20/11/2024. |
| P2 | `/utilitarios/validadores/validador-inscricao-estadual` | A interface prometia comprimento compatível com a UF, mas a implementação aceita 8 a 14 dígitos para todos os estados. | Catálogo, aviso, resultado e FAQ agora explicam a conferência geral e a ausência de comprimento/dígito específicos por UF. |

A vigência do feriado foi conferida na [Lei nº 14.759/2023, arts. 1º e 2º](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm), publicada em 22/12/2023: a primeira ocorrência de 20 de novembro posterior à publicação é em 2024. A calculadora continua sem considerar feriados estaduais ou municipais anteriores a essa data.

## Observações de qualidade que não são falhas completas de implementação

- Os conversores PDF/Office implementam processamento local real, com importação sob demanda de bibliotecas, limites de tamanho/expansão e mensagens sobre perdas de layout. PDF para Word/Excel extrai texto e infere estrutura; não há OCR. PowerPoint/Office não equivale ao mecanismo de renderização do Microsoft Office. Essas limitações devem permanecer visíveis antes do uso.
- Os validadores documentais verificam estrutura ou dígitos; não confirmam titularidade ou existência em cadastros oficiais. O aviso é necessário e está presente nos componentes inspecionados.
- O Meu IP consulta um route handler próprio. IP indisponível em ambiente sem proxy tem estado explícito de ausência; isso não demonstra defeito na produção.
- O menu mobile já possui retenção de foco. Os diálogos corrigidos eram uma implementação separada.
- O registro de todas as ferramentas é importado pela mesma rota dinâmica. A documentação local de Next alerta que importar dinamicamente Client Components a partir de Server Components não garante divisão automática do código. Alterar todos os imports sem medir bundles poderia não resolver o problema; avaliar build e waterfall antes de uma refatoração ampla.

## Pendências identificadas

1. **P2 — Dias úteis:** a lista de datas móveis ainda deve distinguir feriados nacionais de datas cuja aplicação depende de legislação local, com documentação oficial antes de alterar comportamento.
2. **P2 — Acessibilidade dos modais:** a correção cobre circulação por teclado. Não foi aplicada uma migração ampla para `dialog` nativo nem isolamento `inert` do restante da árvore; validar navegação por leitor de tela e sobreposição de múltiplos modais em teste manual.
3. **P2 — Performance:** obter métricas da versão publicada antes de atribuir a reprovação a Core Web Vitals. Não foi estabelecida causalidade entre esses bugs e a decisão do AdSense.

## Validação das correções deste escopo

Comando: `npx vitest run __tests__/lib/random-number-generator.test.ts __tests__/lib/number-draw.test.ts __tests__/lib/secure-random.test.ts __tests__/lib/analytics-client.test.ts __tests__/components/UiDialogFocus.test.tsx`.

Resultado: **5 arquivos e 39 testes aprovados**, duração 8,66 s. Cobertura comportamental adicionada: lote de 1.000 resultados distintos em intervalo de um bilhão, sorteio no intervalo máximo, precisão de limites, rejeição da borda enviesada, permutação completa de intervalo pequeno, remoção de token das URLs coletadas e ciclo de foco dos dois diálogos. O relatório principal registra build, lint geral, testes completos e validação das rotas.

Validação adicional: `npx vitest run __tests__/lib/business-days.test.ts __tests__/components/ValidadorInscricaoEstadualTool.test.tsx` — **2 arquivos e 20 testes aprovados**, duração 6,93 s. O lint focado dos 11 arquivos da primeira rodada terminou com código 0 e sem diagnósticos. Não foi aberto outro processo de lint após as correções adicionais; elas participam da validação geral.

## Arquivos deste escopo

- `lib/random/secure-random.ts`
- `lib/calculators/random-number-generator.ts`
- `lib/calculators/number-draw.ts`
- `lib/analytics/posthog-client.ts`
- `components/ui/Dialog.tsx`
- `components/instagram/Dialog.tsx`
- `__tests__/lib/random-number-generator.test.ts`
- `__tests__/lib/number-draw.test.ts`
- `__tests__/lib/secure-random.test.ts`
- `__tests__/lib/analytics-client.test.ts`
- `__tests__/components/UiDialogFocus.test.tsx`
- `lib/calculators/business-days.ts`
- `lib/validators/state-tax-id.ts`
- `components/tools/validador-inscricao-estadual/ValidadorInscricaoEstadualTool.tsx`
- `components/tools/tool-content.tsx` (somente conteúdo do validador IE neste escopo)
- `data/tools.ts` (descrição do validador IE)
- `__tests__/lib/business-days.test.ts`
- `__tests__/components/ValidadorInscricaoEstadualTool.test.tsx`

Guia local consultado: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`.
