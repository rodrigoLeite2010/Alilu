# Viagens — entrega técnica (21/10/2026)

Implementação local concluída; nenhum deploy foi feito e nenhum serviço foi contratado.

## Arquitetura e decisão de implementação

O projeto usa Next.js 16.3.5 com App Router, React 19, Tailwind 4, ícones Lucide, Auth.js 5 e Postgres/Neon. Foram consultados os guias instalados de páginas, Route Handlers e metadata antes da implementação.

A categoria segue o padrão de Vídeos, Instagram e Loterias: catálogo próprio em `data/viagens.ts` e rotas fora de `/utilitarios/[categoria]`. Assim, não altera contratos do catálogo antigo nem cria URLs duplicadas para a ferramenta. Foram reaproveitados Container, Breadcrumbs com JSON-LD, Button, Icon, FaqJsonLd, metadata, sessão e cliente de banco existentes.

O catálogo já continha custo mensal de carro e divisão de despesas, mas não um planejador de viagem com mala, roteiro e realizado. Essas ferramentas existentes foram preservadas.

## Recursos entregues

- Categoria `/viagens` e ferramenta `/viagens/planejador-de-viagem`.
- Navegação desktop e mobile, home, catálogo, busca global e rodapé.
- Seis etapas: Minha viagem, Transporte, Orçamento, Checklist, Roteiro e Resumo.
- Origem, destino, até cinco paradas, datas, ida ou ida e volta, adultos, crianças, idades opcionais, motivo, transporte, atividades, animais e clima manual.
- Dias civis e noites calculados pelas datas; ajuste opcional de noites, inclusive zero.
- Distância e duração manuais de ida; ida e volta duplica apenas os valores manuais. Rotas automáticas consultam a sequência completa nos dois sentidos, sem duplicar novamente o total retornado.
- Combustível por consumo médio ou frações urbana e rodoviária; consumo e preço alternativos para etanol.
- Pedágios separados por sentido. Campo vazio indica pendência; zero é uma confirmação explícita. Custos de estacionamento e paradas separados.
- Transporte, hospedagem, alimentação por pessoa ou grupo, lazer, extras e percentual de imprevistos. Valores em centavos nos agregados; média por dia e pessoa, diferença para orçamento, comprometimento e valor a economizar.
- Gastos reais por categoria e data, comparados com o planejamento. Não entram novamente na previsão. Passeios com custo no roteiro já entram em Lazer, uma única vez.
- Checklist com sugestões para duração, pessoas, idades, transporte, motivo, atividades, clima manual e animais; adicionar, editar, excluir, ordenar e concluir. Tipos: recomendação, opcional e verificar requisito legal. Geração adicional preserva edições e conclusões existentes; quantidades podem precisar de revisão após mudar a viagem.
- Roteiro em linha do tempo, horário, dia e custo adicional por atividade; alteração de dia move a atividade. Atividades fora das datas são sinalizadas.
- Simulações de noite adicional, café incluído, divisão por viajantes, redução do gasto diário, poupança semanal/mensal e três cenários de custo com percentuais editáveis e premissas visíveis.
- Rascunho local apenas após ação explícita, restauração e remoção. Não salva silenciosamente em dispositivos compartilhados.
- Conta: criar, reabrir, editar, duplicar, listar, arquivar/desarquivar e excluir viagens, incluindo mala, roteiro e gastos reais. Limite de 100 viagens na criação e 100 na listagem.
- Conflitos de edição: a revisão do plano precisa corresponder à versão do banco; outra aba não é sobrescrita silenciosamente.
- PDF multipágina no navegador, impressão e prévia explícita antes de abrir WhatsApp. Nenhuma viagem ganha URL pública, e nenhum resumo é enviado automaticamente.

## Integrações efetivas

### Auth.js e Postgres/Neon

As APIs usam `requireUserId()` e o cliente `getDb()` do projeto. Toda leitura, atualização e exclusão filtra o proprietário da sessão. Respostas privadas não são cacheadas. IDs UUID e todos os campos persistidos são validados e limitados. A procedência de rota fornecida pelo cliente não é aceita como fato de API: ao salvar/restaurar, só os valores manuais são conservados, e o traçado precisa de nova consulta.

A migração **0045_travel_plans.sql foi aplicada com sucesso ao banco configurado**, pelo runner existente, após verificar que 0001–0044 já estavam aplicadas. É aditiva: cria `travel_plans`, índice de proprietário e `travel_route_quotas`. Nenhuma viagem de demonstração foi inserida, nenhum registro de usuário foi alterado e nenhuma migração destrutiva foi executada.

O CRUD e os limites foram verificados com as migrações reais em PGlite. Não foi simulado login de uma pessoa nem criado planejamento fictício no banco conectado.

### ANP — pesquisa oficial datada

Foi importada a planilha oficial da semana **11/10/2026–17/10/2026**. São **1.662 médias** por município e estado, para gasolina comum, etanol hidratado, diesel S500 e diesel S10. O arquivo contém exclusivamente agregados públicos, sem identificação de postos ou passageiros.

- Dados servidos estaticamente em `/data/viagens/anp-prices.json`, carregados apenas ao clicar.
- Usuário seleciona combustível, estado e município ou média estadual. Nenhum fallback estadual é apresentado como municipal.
- Exibe período da pesquisa, quantidade de postos pesquisados, abrangência e link para a planilha original.
- Aplicação do preço é explícita; o campo continua editável.
- Após 21 dias, há aviso de referência histórica. Não é cotação em tempo real.
- Atualização via `python scripts/import-anp-prices.py URL_OFICIAL_XLSX`. O importador verifica domínio, estrutura, unidade, valores e período, e grava hash SHA256 da origem. Não há cron nem custo recorrente.
- SHA256 da planilha importada: `41790a14ee758cf9d2582b6c0e1e5c5d7e0f17cd6c8ca91f476f75193d2bcf5f`.

Fontes: [publicação semanal ANP](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas) e [planilha efetivamente importada](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc/2026/resumo_semanal_lpc_2026_10_11-2026_10_17.xlsx).

### Roteamento — adaptador pronto, não ativado

Implementado adaptador server-only openrouteservice, com geocodificação de cidades brasileiras, múltiplas paradas, distância e duração rodoviária, retorno pela sequência inversa e traçado esquemático com atribuição. As cidades identificadas ficam visíveis para conferência. É perfil de carro: restrições específicas de moto precisam ser verificadas. Não estima trânsito ou tempo de descanso.

Só funciona quando **ambas** as variáveis estão definidas no servidor:

```dotenv
TRAVEL_ROUTES_ENABLED=true
ORS_API_KEY=chave_do_operador
```

O padrão é desativado. Nenhuma conta ou chave foi criada/contratada. A integração foi testada com respostas simuladas e falhas; **não houve consulta real ao provedor**.

Login obrigatório na consulta de rota; 10 consultas por usuário por janela de 24h, com UPSERT atômico no Postgres, inclusive entre instâncias serverless. Falhas consomem a tentativa, evitando repetição abusiva. Até sete geocodificações e uma consulta de direções por ação; timeout de 10 segundos por requisição. Não há chamadas ao digitar. Ausência da integração, autenticação, quota ou banco não impede a edição manual.

Não foi ativado cache persistente de respostas externas: é necessário confirmar termos de armazenamento na conta antes disso. O traçado é um esquema sem escala uniforme, **não um mapa com tiles ou uma navegação GPS**.

Avaliação de provedores:

| Opção | Avaliação |
| --- | --- |
| openrouteservice | Adaptador implementado; documentação pública, perfil rodoviário e geocodificação. A restrição pública de driving é 6.000 km e 50 pontos; o limite local é menor. Confirmar a quota efetiva, termos e capacidade comercial da conta antes de habilitar. |
| GraphHopper | Alternativa com créditos por requisição e planos comerciais. Não contratado nem implementado; possível substituição na camada de roteamento. |
| OSRM próprio | Alternativa com custo de infraestrutura e manutenção dos dados. Não instalado. Servidor público de demonstração não foi usado como backend de produção. |

Referências: [openrouteservice Directions](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/), [restrições](https://openrouteservice.org/restrictions/), [GraphHopper — créditos](https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit-) e [planos](https://www.graphhopper.com/pricing/).

### Pedágios, clima e compartilhamento

Não há provedor de pedágios ou previsão do tempo conectado. Pedágios são manuais e pendências aparecem no resumo, no PDF e no texto de compartilhamento. O checklist considera o clima informado pelo usuário; não afirma ter consultado uma previsão.

WhatsApp usa link de composição depois de uma prévia. A pessoa escolhe o destinatário e confirma o envio no aplicativo. PDF e impressão processam no navegador; não há serviço externo de geração nem armazenamento público de planos.

## SEO e performance

Páginas públicas estáticas, metadata exclusiva, canonical, Open Graph, Twitter, breadcrumbs, FAQ visível com JSON-LD e WebApplication gratuito. Título absoluto do planejador conforme o pedido. Inclusão das nove URLs de Viagens no sitemap. Nenhuma página automática por cidade.

Sete guias distintos com conteúdo e links internos:

1. `/viagens/calculadora-de-combustivel`
2. `/viagens/calculadora-de-pedagios`
3. `/viagens/quanto-custa-viajar-de-carro`
4. `/viagens/calculadora-orcamento-de-viagem`
5. `/viagens/checklist-mala-de-viagem`
6. `/viagens/lista-viagem-com-criancas`
7. `/viagens/organizar-viagem-gastando-pouco`

PDF é carregado dinamicamente, o snapshot ANP de aproximadamente 143 KB só é buscado sob demanda e os cálculos são locais. Não foram medidos Core Web Vitals de produção; isso depende da publicação e de tráfego real.

## Verificações

- `npm run build`: aprovado, incluindo TypeScript e geração estática das páginas.
- ESLint dos arquivos TypeScript/TSX alterados: aprovado.
- **432 testes aprovados em oito arquivos**, incluindo cálculos, arredondamento, datas/dias/noites, ida e volta, consumos distintos, ausência de valores, pedágio zero versus pendente, não duplicação, checklist, rascunho, aplicação explícita de referência ANP, falha de snapshot, validação, autenticação, propriedade, conflitos, arquivamento, exclusão, quota atômica, falhas de roteamento, regressões de SEO e categorias da home.
- Banco de testes: PGlite com as migrações reais; nenhum teste gravou dados de exemplo no banco conectado.
- Navegador em 390 × 844 e 1440 × 1000: navegação entre etapas, cálculo manual, seleção de município e aplicação de média ANP, checklist, resumo e exportação. Sem transbordamento horizontal da página nas duas larguras; as abas têm rolagem própria no celular.
- PDF baixado pelo navegador e renderizado com Poppler; legibilidade e quebra de linhas conferidas. Textos dinâmicos tratados para fontes PDF padrão, margens, seções e numeração de páginas.
- `git diff --check`: aprovado.
- Evidência visual: [mobile](viagens/mobile.png). Os valores são preenchimento temporário de teste, sem registro no banco.

Comando da rodada de testes:

```powershell
npm test -- __tests__/lib/viagens.test.ts __tests__/lib/viagens-repository.test.ts __tests__/lib/viagens-routing.test.ts __tests__/lib/viagens-routes.test.ts __tests__/components/TravelPlanner.test.tsx __tests__/components/AnpPrices.test.tsx __tests__/seo/seo-rules.test.ts __tests__/components/HomepageCategories.test.tsx
```

## Arquivos criados

- `data/viagens.ts`
- `app/viagens/page.tsx`
- `app/viagens/planejador-de-viagem/page.tsx`
- `app/viagens/[slug]/page.tsx`
- `components/viagens/TravelPlanner.tsx`
- `components/viagens/AnpPrices.tsx`
- `lib/viagens/planner.ts`
- `lib/viagens/repository.ts`
- `lib/viagens/routing.ts`
- `app/api/viagens/route.ts`
- `app/api/viagens/rota/route.ts`
- `db/migrations/0045_travel_plans.sql`
- `public/data/viagens/anp-prices.json`
- `scripts/import-anp-prices.py`
- `__tests__/lib/viagens.test.ts`
- `__tests__/lib/viagens-repository.test.ts`
- `__tests__/lib/viagens-routing.test.ts`
- `__tests__/lib/viagens-routes.test.ts`
- `__tests__/components/TravelPlanner.test.tsx`
- `__tests__/components/AnpPrices.test.tsx`
- Este relatório e `docs/viagens/mobile.png`.

## Arquivos existentes alterados

- `.env.example`
- `app/sitemap.ts`
- `app/utilitarios/page.tsx`
- `data/site-search.ts`
- `components/ui/Icon.tsx`
- `components/navigation/SiteNav.tsx`
- `components/mobile/mobile-links.ts`
- `components/home/CategoryGrid.tsx`
- `components/layout/Footer.tsx`

## Custos e pendências operacionais

- **Nenhuma contratação, assinatura, deploy ou ativação de cobrança externa foi feita.**
- O CRUD usa o Postgres/Neon e funções Vercel existentes; volume e armazenamento entram nas cotas dos planos atuais.
- Dados ANP estáticos e PDF local não exigem fornecedor pago. Atualizar a pesquisa periodicamente pelo importador e publicar o snapshot atualizado junto ao site.
- Para distância automática real: fornecer a chave, conferir as condições e limites da conta openrouteservice e habilitar explicitamente. Permanecer manual é plenamente funcional.
- Pedágios confiáveis, previsão automática e mapa cartográfico ficam pendentes de escolher integrações adequadas e verificar cobertura/termos. Não há informação inventada preenchendo essas lacunas.
- Publicação em produção depende de autorização. A migração aditiva já está aplicada no banco configurado; o código ainda é local.
