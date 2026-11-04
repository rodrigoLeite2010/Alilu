# Relatório de testes — importador de imóveis de parceiros

Data: 04/11/2026. Ambiente: Linux, Node 22, Postgres real em memória (PGlite) com **todas** as migrações do projeto, sem rede externa (DNS e feed simulados), sem Blob real, sem produção.

## Resultado

| Suíte | Testes | Resultado |
| --- | --- | --- |
| `__tests__/lib/imoveis-integracoes-parsers.test.ts` | 16 | ✅ todos aprovados |
| `__tests__/lib/imoveis-integracoes-ssrf.test.ts` | 4 | ✅ todos aprovados |
| `__tests__/lib/imoveis-integracoes.test.ts` (Postgres) | 19 | ✅ todos aprovados |
| `__tests__/components/ImoveisIntegracoes.test.tsx` | 4 | ✅ todos aprovados |
| **Novos — total** | **43** | ✅ |
| Regressão Imóveis (`imoveis.test.ts`, `Imoveis.test.tsx`), SEO (`seo-rules`), `admin-links` | 440 (1 fixture opcional ignorada) | ✅ |
| `npx tsc --noEmit` | — | ✅ (após `next build` gerar os tipos de rota) |
| `npm run lint` | — | ✅ 0 erros; 7 avisos já existentes fora do módulo |
| `npm run build` | 256 páginas | ✅ novas rotas: `/admin/imoveis/integracoes`, `/api/imoveis/integracoes/[[...path]]`, `/api/cron/imoveis-integracoes`, `/imoveis/saida/[id]` |

### Regressão ampla

Execução completa (394 arquivos, 4.238 testes) com 6 workers numa máquina de 2 CPUs: 713 falhas, todas por *timeout* de hooks/testes de outros módulos causadas pela sobrecarga. Os 63 arquivos afetados foram reexecutados com `--maxWorkers=2 --testTimeout=90000 --hookTimeout=90000`: **875 aprovados, 2 reprovados**. Os 2 reprovados são do módulo Instagram (`InstagramPainelPage.test.tsx` — link de reconexão sem `forceReauth=1`; `instagram-oauth-service.test.ts` — mock ausente de `getInstagramAccountBy…`) e **falham igualmente no checkout original sem nenhuma alteração desta tarefa** (verificado com `git stash`). Não foram corrigidos por estarem fora do escopo.

## Cobertura dos 30 itens pedidos

| # | Cenário | Onde |
| --- | --- | --- |
| 1 | Importação XML | parsers: XML personalizado; Postgres: feed VRSync |
| 2 | JSON | parsers: coleção detectada/informada, imagens aninhadas |
| 3 | CSV | parsers: separador, aspas, BOM, Windows-1252; Postgres: CSV-modelo importado |
| 4 | Excel | parsers: modelo gerado + planilha do openpyxl com escolha de aba |
| 5 | VRSync | fixture `EXEMPLO_IMPORTACAO_IMOVEIS.xml` (estrutura pública ListingDataFeed) — leitura, mapeamento e conversão |
| 6 | Mapeamento manual | Postgres (mapeamento salvo por fonte/versão); componente (padrões) |
| 7 | Mapeamento automático | parsers: modelo, JSON e VRSync; componente |
| 8 | Conversão de valores | números BR/internacionais, centavos, hectares, UF por nome, tipos, finalidades, características |
| 9–10 | Erro de arquivo / malformado | JSON, XML, XLSX inválidos; arquivo vazio |
| 11 | Campo obrigatório ausente | erros por campo; nunca publicado |
| 12 | Fotos inválidas | http, domínio não autorizado, vídeo → descartadas; sem foto → pendente |
| 13 | URL externa indisponível | sincronização com HTTP 500 → lote falho, nada alterado |
| 14 | Duplicidade no parceiro | reimportação atualiza o mesmo anúncio; código repetido no arquivo |
| 15 | Duplicidade entre parceiros | foto idêntica sinaliza; preço/área/bairro parecidos não sinalizam; nada excluído |
| 16 | Atualização de preço | mesmo `property_id`, revisão +1, histórico `partner-sync` |
| 17 | Disponibilidade | Vendido → `sold`; Inativo → `paused` |
| 18 | Removido do feed completo | tolerância 2, pausa só na 2ª ausência; reaparece e volta |
| 19 | Feed incremental | só eventos explícitos; ausência ignorada |
| 20 | Falha de sincronização | HTTP, feed vazio, XML malformado → falha, contador, log; imóveis preservados |
| 21 | Idempotência | segunda importação igual: 0 criados, 2 inalterados; cron não executa a mesma fonte duas vezes |
| 22 | Reprocessamento | falha por limite do parceiro → reprocessar após ajuste |
| 23 | Permissões administrativas | API 403 sem admin; origem externa 403 |
| 24 | Isolamento entre parceiros | mesmo código em dois parceiros = dois anúncios; ações em lote não alcançam diretos |
| 25 | Preservação dos anúncios diretos | status/revisão/sitemap/SEO do direto intactos em importação, ausências e ações em lote |
| 26 | SEO | importado `noindex,follow` por padrão e fora do sitemap; `index` quando autorizado; direto sem mudança; robots |
| 27 | Paginação e performance | 600 imóveis em passos com checkpoints; CSV de 20.000 linhas < 5 s; limite de 20.000; partes ≤ 3 MB |
| 28 | URLs e SSRF | IPs internos/metadados/mapeados, DNS misto, portas, credenciais, esquemas, headers |
| 29 | XML malicioso | DOCTYPE/XXE e billion laughs recusados; entidade indefinida |
| 30 | Uploads | limites de bytes/registros/campos; fórmulas de planilha não executadas; relatório CSV com fórmulas neutralizadas |

Também: autorização vencida/obrigatória, CPF/CNPJ cifrado, token de feed cifrado e ausente de respostas e logs, suspensão reversível do parceiro, remoção/rejeição administrativa prevalece sobre o feed, contagem de cliques por visitante/dia e redirecionamento seguro.

## Smoke HTTP no build de produção local

| Requisição | Resposta |
| --- | --- |
| `GET /api/cron/imoveis-integracoes` sem Bearer | 401 |
| `GET /api/imoveis/integracoes/painel` anônimo | 403 |
| `GET /admin/imoveis/integracoes` anônimo | 404 |
| `GET /imoveis/saida/<inválido>` | 302 para `/imoveis` |
| `GET /imoveis/modelos/MODELO_IMPORTACAO_IMOVEIS.xlsx` | 200 (xlsx) |
| `GET /robots.txt` | contém `Disallow: /imoveis/saida/` |

## Não testado (exige homologação)

- Neon e Vercel Blob reais, login Google/OTP real e cron agendado real.
- Feed real de um parceiro (o VRSync de teste segue a estrutura pública conhecida; validar com o arquivo do parceiro).
- Revisão visual do painel no navegador com sessão de administrador real.
- Cópia de fotos para o Blob (modo opcional) contra servidor de imagens real.

## Comandos

```powershell
npx vitest run __tests__/lib/imoveis-integracoes.test.ts __tests__/lib/imoveis-integracoes-parsers.test.ts __tests__/lib/imoveis-integracoes-ssrf.test.ts __tests__/components/ImoveisIntegracoes.test.tsx
npx vitest run __tests__/lib/imoveis.test.ts __tests__/components/Imoveis.test.tsx __tests__/seo/seo-rules.test.ts __tests__/lib/admin-links.test.ts
npm run build
npx tsc --noEmit
npm run lint
```
