# Implementação de Imóveis — Alilu

## Correção dos valores monetários

Preço do imóvel, condomínio, IPTU e outras taxas usam campos de texto com teclado decimal, leitura de valores em reais e formatação brasileira ao sair do campo. Por exemplo, `2.659.574,47` é enviado à API como `2659574.47`; `930` é formatado como `930,00`. Digitar/colar valores com separadores de milhar não depende mais da interpretação do `input type="number"` pelo navegador.

Entradas ambíguas como `2,65957447` são recusadas em vez de virarem um preço como R$ 2,66. A API também exige no máximo duas casas decimais para os quatro campos monetários. A correção não altera automaticamente anúncios existentes: valores salvos anteriormente com escala incorreta precisam ser informados novamente no editor, pois não é possível deduzir com segurança o preço pretendido.

Validação desta correção: 45 testes aprovados em três arquivos (parser/formatação, interação do formulário e banco/API), com uma fixture visual opcional ignorada. Inclui releitura do anúncio publicado, valores com milhões/centavos e precisão monetária inválida. Nenhuma migração é necessária.

Data: 28/10/2026. Implementação local; **não houve deploy, migração no Neon nem anúncio fictício em produção**.

## Auditoria e arquitetura

O projeto usa Next.js 16.3.5 / App Router, React 19, TypeScript e Tailwind 4. As instruções instaladas em `node_modules/next/dist/docs` sobre páginas, parâmetros assíncronos, Route Handlers, metadados, sitemap e ImageResponse foram consultadas antes da implementação.

Foram reutilizados:

- Postgres/Neon via `lib/db/client.ts`, consultas parametrizadas e o runner de migrações existente.
- Auth.js v5 em `auth.ts`: Google ou código por e-mail; o ID da sessão identifica o proprietário. A desativação global de contas também é respeitada.
- `getAdminSession()` e `ADMIN_EMAILS` para administração.
- Vercel Blob público já usado pelas mídias da Alilu. O prefixo exclusivo `imoveis/` isola os arquivos do módulo das rotinas de limpeza dos outros módulos.
- A criptografia AES-256-GCM existente para telefone, endereço, CEP e comprovante de consentimento. A chave existente **não deve ser substituída** sem recifrar todos os dados afetados, inclusive os outros módulos.
- Paleta verde-petróleo/laranja, componentes e convenções de navegação e SEO da Alilu.
- Calculadora SAC/Price em `lib/calculators/financing.ts` e seus componentes. Acrescentado um valor inicial opcional, preservando os demais usos da calculadora.

Imóveis é um módulo com rota própria, seguindo o padrão de áreas como Viagens e Instagram. Não foi inserido artificialmente no catálogo de ferramentas locais de `data/categories.ts`.

## Funcionalidades

| Área | Entrega |
| --- | --- |
| Navegação | Menu principal, cabeçalho, home, busca global da home, catálogo, rodapé e atalhos mobile |
| Busca | Venda, aluguel, temporada, UF, cidade, bairro, tipo, preço mínimo/máximo, quartos, vagas, área e características; filtros na URL |
| Resultados | Paginação de 12, ordenação por recência/preço/área, miniatura, preço e resumo; filtros recolhíveis no celular |
| Cadastro | Cinco etapas, campos condicionais por tipo, rascunho incompleto, consentimento e envio à moderação |
| Fotos | Seleção múltipla, arrastar/soltar, preparação local, upload persistente, miniaturas, capa, reordenação por botões, remoção e galeria ampliada |
| Detalhes | Descrição, características, taxas com periodicidade, anunciante, CRECI informado, região aproximada via mapa externo |
| Contato | WhatsApp solicitado ao servidor, mensagem com URL, compartilhar, compartilhar pelo WhatsApp e copiar link |
| Favoritos | Persistidos por usuário autenticado, com listagem privada e remoção |
| Anunciante | Editar, alterar preço e fotos, pausar, reativar para análise, marcar vendido/alugado e excluir |
| Moderação | Fila com pendentes primeiro, conteúdo e fotos, aprovação, rejeição/bloqueio com motivo, remoção, denúncias, suspensão/liberação do anunciante |
| Auditoria | Histórico de conteúdo público, ordem das fotos, status e responsável; tela paginada de histórico completo |
| Configuração | Limite de anúncios, limite de fotos, tipos, características e orçamento de storage no admin |
| Métricas | Acessos e cliques deduplicados por visitante/imóvel/dia, sem guardar IP em texto no módulo |
| Financiamento | Simulação SAC/Price com valor do imóvel preenchido; entrada, taxa, prazo e sistema continuam editáveis |

Rotas principais:

```text
/imoveis
/imoveis/anunciar
/imoveis/[slug]
/imoveis/meus-anuncios
/imoveis/editar/[id]
/imoveis/favoritos
/imoveis/financiamento?valor=500000
/imoveis/cidade/[state]/[city]
/imoveis/sitemap.xml
/admin/imoveis
/admin/imoveis/historico/[id]
/api/imoveis/[[...path]]
/api/cron/imoveis
```

## Banco e consistência

Migração **aditiva**: `db/migrations/0046_imoveis.sql`. Não executada no ambiente externo. Aplicada aos bancos Postgres isolados dos testes.

| Tabela | Finalidade |
| --- | --- |
| `properties` | Proprietário, slug estável, dados públicos JSONB, dados privados cifrados, status, revisão, vencimento, métricas e assinatura de duplicação |
| `property_images` | Proprietário da foto, vínculo ao anúncio, ordem, URLs, bytes reservados/usados e marcação para exclusão |
| `property_settings` | Configuração única do módulo |
| `property_advertisers` | Suspensão do anunciante no módulo |
| `property_favorites` | Relação usuário/imóvel, sem duplicação |
| `property_reports` | Denúncia autenticada por usuário/imóvel e situação de análise |
| `property_history` | Alterações do conteúdo público e mudanças de status; não guarda telefone/endereço privados |
| `property_rate_limits` | Quotas distribuídas, deduplicação diária e cursor da limpeza |

As funções SQL `save_property`, `transition_property` e `reserve_property_image` tornam atômicos os fluxos que precisam de locks. O salvamento bloqueia o proprietário, confere limite de anúncios, revisão e propriedade de todas as fotos antes de alterar dados ou vínculos. A reserva de upload bloqueia a configuração para garantir o teto global de bytes mesmo com uploads concorrentes.

Edições concorrentes não se sobrescrevem silenciosamente. A moderação via API exige a revisão aberta pelo administrador. Anúncios publicados editados voltam a rascunho ou análise. Rejeitados precisam ser corrigidos e reenviados; não há publicação automática nem selo de verificação. A assinatura de duplicação é por anunciante, finalidade, título normalizado, cidade, bairro e área; não constitui detecção universal de fraude.

Existem índices por proprietário, status/data, localização/tipo, preço, área, características GIN e vínculo/ordem de fotos. Consultas públicas têm projeção explícita, sem o proprietário ou o bloco privado.

Status: `draft`, `pending`, `published`, `paused`, `sold`, `rented`, `rejected`, `removed`. Aprovações têm validade de 90 dias. Anúncios vencidos somem imediatamente da busca, contato e sitemap, mesmo antes do cron. O cron converte o estado para pausado, com orientação para reativação.

## Upload e limpeza

Nenhuma imagem grande é guardada no banco. A interface aceita originais JPEG/PNG/WebP de até 15 MB e prepara um WebP menor antes do envio. O servidor aceita no máximo **3 MiB por requisição**, com leitura limitada do stream, valida extensão/MIME/formato decodificado e limita a imagem a 40 megapixels, no mínimo 200 × 200. Imagens animadas e conteúdo inválido são recusados.

`sharp` 0.35.4 foi promovido a dependência direta (já existia transitivamente pelo Next). O servidor gera WebP de até 1600 pixels e miniatura 480 × 360, sem EXIF, GPS ou outros metadados. Cada par pode ter até 2 MiB. Não se usa `keepMetadata`/`withMetadata` no processamento de produção.

Cada anúncio permite inicialmente 20 fotos; configuração entre 1 e 20. Cada usuário permite inicialmente 10 anúncios. A reserva global padrão de 500 MiB é exclusiva deste módulo e não mede o total consumido pelos demais recursos da Alilu.

As imagens têm IDs e caminhos imutáveis, cache de um ano no Blob e lazy loading nas listagens/miniaturas. As páginas públicas permanecem dinâmicas para refletir imediatamente bloqueios, alterações e remoções. A configuração tem memoização de leitura na renderização. Não existe cache compartilhado de HTML contendo dados privados.

Fotos retiradas de um anúncio entram em fila na mesma transação do salvamento. Fotos novas removidas do formulário são marcadas imediatamente. Uploads abandonados entram na fila após 24 horas. O cron exclui até 100 registros por execução e também percorre uma página de até 100 blobs por vez com cursor persistido para encontrar órfãos de contas excluídas ou falhas de processo. Só atua no prefixo `imoveis/`; não interfere nas mídias de Instagram/vídeos. Uma exclusão no provedor que falhe mantém o registro para nova tentativa.

## Segurança, privacidade e operação

- Autenticação real em todas as alterações; proprietários são obtidos da sessão, nunca aceitos do formulário.
- Validação de origem nas mutações, IDs UUID, conteúdo, números, enumerações, comprimento e tamanho da requisição.
- Quotas no Postgres: 60 mutações/min por conta, 10 criações/h, 100 uploads/h, 5 denúncias/h e 60 solicitações públicas de métricas/contato por minuto por chave diária.
- Chave diária HMAC derivada da origem de rede para deduplicação; IP não é persistido pelo módulo. Chaves antigas são apagadas após dois dias pelo cron. O host deve fornecer corretamente os headers de proxy; em infraestrutura diferente da Vercel essa confiança precisa ser revista.
- Telefone e endereço privado não entram nos componentes públicos, JSON-LD ou metadados. O número é entregue ao WhatsApp quando o visitante pede contato; esse recurso não torna o número impossível de obter por terceiros.
- A região no mapa é composta somente por bairro/cidade/UF. Não existe geocodificação automática do endereço residencial privado.
- A exclusão do anúncio limpa o bloco privado, dados públicos, favoritos, denúncias e snapshots anteriores. Permanece um registro mínimo de remoção e a fila de limpeza de arquivos. Backups do provedor e cópias/caches externos não são apagados instantaneamente por esta operação.
- Termos e privacidade foram atualizados para o portal. A autorização do formulário tem versão e data no bloco cifrado.
- Corretores/imobiliárias precisam informar CRECI; o formato é validado e a conferência é manual na moderação. Não foi contratado serviço de consulta. A identificação profissional aparece no detalhe, cards e imagem de compartilhamento.

O admin deve conferir identificação profissional e autorização, conteúdo das fotos, duplicação, dados pessoais expostos em texto/imagens e, quando aplicável, registros de incorporação/loteamento antes de aprovar. O [CRECI-CE](https://creci-ce.gov.br/exercicio_ilegal) descreve exigências de identificação e autorização e situações que demandam documentos adicionais. O formulário e a moderação não substituem essa conferência documental.

## SEO

Slugs amigáveis com UUID, canonical estável mesmo após alteração de título, metadados individuais, JSON-LD `RealEstateListing`/`Offer`, Open Graph com foto/título/preço e identificação profissional, links internos e imóveis semelhantes.

Anúncios vendidos/alugados mantêm uma página informativa com `noindex` e contato indisponível. Pausados, rejeitados, removidos, suspensos ou vencidos deixam de ser públicos. Sitemap consulta somente anúncios ativos e contas habilitadas. Páginas de cidades existem somente se houver anúncios reais e retornam 404 quando a cidade não tem anúncios ativos. Filtros são `noindex,follow`; paginação geral tem canonical por página e páginas fora do intervalo retornam 404.

O sitemap específico é anunciado no `robots.txt`, sem obrigar o sitemap estático das ferramentas a consultar o banco. Limite inicial: 45 mil anúncios e 200 cidades no sitemap; particionar antes de ultrapassar esse volume. Áreas privadas têm `noindex` e bloqueio no robots; esses mecanismos complementam a autenticação e não a substituem.

## Configuração e publicação

Não há um novo serviço, plano ou contrato. Reutiliza `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTH_SECRET`, providers de login, `INSTAGRAM_TOKEN_ENCRYPTION_KEY`, `ADMIN_EMAILS` e `NEXT_PUBLIC_SITE_URL`. Os nomes também estão comentados em `.env.example`.

1. Revisar a migração e aplicar primeiro em um banco/branch de homologação, com as migrações anteriores presentes. O comando existente `npm run db:migrate` aplica **todas** as migrações ainda pendentes; conferir a lista antes de executá-lo. Nunca apontar testes com fixtures para o banco de produção.
2. Configurar homologação com Blob separado ou ambiente apropriado e a chave de criptografia estável. Confirmar o login e o acesso de `ADMIN_EMAILS`.
3. Executar os comandos de validação abaixo e testar um anúncio de homologação de ponta a ponta com duas contas reais e uma conta administradora.
4. Configurar chamada diária `GET /api/cron/imoveis` com header `Authorization: Bearer <segredo>`. Reutiliza `STORAGE_CLEANUP_CRON_SECRET`, `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET` (mínimo 16 caracteres), como o cron existente de storage. Não colocar o segredo na URL. Sem o agendamento, uploads abandonados não são eliminados automaticamente.
5. Conferir limites e orçamento em `/admin/imoveis`, acompanhar uso global no painel Vercel e validar a rotina de denúncias/CRECI com quem fará a moderação.
6. Após autorização para produção, aplicar a migração aditiva no banco correto e publicar o código. Nenhum desses passos de produção foi executado nesta tarefa.
7. Confirmar `/imoveis`, `/imoveis/sitemap.xml`, `robots.txt`, anúncio real, metadados e imagem OG. Acompanhar os primeiros uploads e o cron. Para retirar a funcionalidade, reverter o código/links, preservando as tabelas e arquivos até decidir sua retenção; não executar rollback destrutivo automático.

## Custos potenciais

Não foi consultado o faturamento privado da conta nem alterado plano. O [preço oficial do Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing), consultado em 28/10/2026, informa inclusão Hobby de 1 GB de storage, 10 mil operações simples, 2 mil avançadas e 10 GB de transferência. As franquias são compartilhadas; outros módulos também as consomem. Fora das franquias, o documento mostra storage a US$ 0,023/GB e transferência a US$ 0,05/GB, sujeitos ao plano/região, além de operações/CDN. Upload pelo servidor também consome recursos de transferência e processamento da aplicação.

Gratuidade do anúncio não garante custo zero de infraestrutura. Cada foto gera dois uploads. Sob o teto técnico de 2 MiB por par, um anúncio de 20 fotos ocupa até 40 MiB; a ocupação típica tende a ser menor. O admin exibe bytes usados/reservados e bloqueia novas reservas no teto definido. Usar os alertas/Spend Management existentes da Vercel para custos globais. A geração OG, o banco e as Functions também consomem franquias. Nenhum serviço pago foi contratado.

## Verificação

Testes novos em `__tests__/lib/imoveis.test.ts` e `__tests__/components/Imoveis.test.tsx` usam Postgres real isolado em memória (PGlite, com as migrações do projeto), mocks somente de identidade/provider Blob e testes de interação com React Testing Library.

Cobrem persistência/releitura, publicação, preço, ordem/capa, fotos de outra conta, revisão concorrente, duplicação, rascunho incompleto, consentimento, CRECI, busca/ordenação/favoritos, pausa/reativação/venda, exclusão, suspensão, conta desativada, quotas, storage, vencimento, versão da moderação, WhatsApp, deduplicação de cliques, denúncias, origem externa, admin não autorizado, requisição excessiva, imagem falsa e remoção de EXIF. A interface cobre etapas, preço, upload múltiplo, limite de fotos, capa, remoção, favoritos, copiar link, galeria e filtros mobile.

Comandos:

```powershell
npx vitest run __tests__/lib/imoveis.test.ts __tests__/components/Imoveis.test.tsx
npx vitest run __tests__/seo/seo-rules.test.ts __tests__/components/HomepageCategories.test.tsx __tests__/lib/financing.test.ts
npx tsc --noEmit
npm run lint
npm run build
```

Os testes dirigidos e o build passaram durante a implementação. O lint global passou sem erros, com sete avisos já existentes fora do módulo. O teste do Open Graph executa o renderizador real e confere a assinatura PNG; a foto WebP é convertida para PNG no servidor porque o renderizador instalado não aceita WebP diretamente. A leitura da foto restringe host/prefixo do Blob, tamanho, redirects e tempo de resposta.

Na execução ampla, o teste de Lotomania `bloqueia a geração no modo Personalizado quando o número de obrigatórios excede a aposta (50)` excedeu seu timeout padrão de 5 segundos, fora dos arquivos funcionais alterados. A mesma suíte passou com `--testTimeout=15000` (13 testes), sem alteração do teste nem do módulo de loterias. O resultado final de regressão está registrado ao final deste documento.

Revisão visual usa os componentes reais renderizados com fixtures locais de teste, sem hidratação e sem persistência externa. A fixture opcional é gerada por:

```powershell
$env:IMOVEIS_VISUAL_QA='1'
npx vitest run __tests__/lib/imoveis.test.ts
Remove-Item Env:IMOVEIS_VISUAL_QA
```

Arquivos de QA ficam em `.codex-temp/imoveis-qa/`, ignorados pelo Git. Foram revisados listagem, detalhe, formulário e financiamento em larguras mobile/desktop. As interações são cobertas pelos testes React; a revisão visual estática **não equivale** a um teste E2E autenticado com os provedores reais.

## Pendências operacionais e limites conhecidos

- Aplicar a migração e agendar o cron em homologação/produção conforme autorização.
- Testar login e upload no Blob real em homologação; os testes automatizados não enviam arquivos ao storage externo nem autenticam no Google/OTP real.
- Executar a conferência documental/CRECI no processo de moderação. Não há alegação de verificação automática ou de conformidade jurídica certificada.
- Métricas são aproximações por chave diária de rede: pessoas na mesma rede podem ser agrupadas. Não são analytics de conversão ou garantia de interessados únicos.
- Cache de fotos públicas e cópias externas podem sobreviver temporariamente à exclusão. Fotos de anúncios ainda não aprovados têm URLs públicas imprevisíveis no Blob, sem aparecer no catálogo; não enviar imagens confidenciais.
- Alertas por e-mail de novos imóveis/mudanças de preço não foram ativados, conforme escopo opcional. Não há assinatura automática ou marketing sem autorização.
- Antes de crescimento substancial, particionar sitemap, revisar paginação profunda e orçamento de processamento/transferência e avaliar proteção adicional de borda contra bots. O orçamento de storage local não é um bloqueio global de gastos Vercel.

## Arquivos alterados

Novos: `data/imoveis.ts`; `db/migrations/0046_imoveis.sql`; `lib/imoveis/{model,repository,http,images}.ts`; `components/imoveis/{PropertyForm,PropertySearch,PropertyCard,PropertyActions,FilterPanel,OwnerPanel,AdminPanel}.tsx` e `client.ts`; toda a árvore `app/imoveis`; `app/admin/imoveis` (incluindo histórico); `app/api/imoveis/[[...path]]/route.ts`; `app/api/cron/imoveis/route.ts`; dois arquivos de testes acima; este relatório.

Integrações alteradas: `components/navigation/SiteNav.tsx`, `components/layout/{Header,Footer}.tsx`, `components/mobile/mobile-links.ts`, `components/home/CategoryGrid.tsx`, `data/site-search.ts`, `__tests__/data/site-search.test.ts`, `app/utilitarios/page.tsx`, `app/admin/page.tsx`, `lib/admin/admin-links.ts`, `app/{sitemap,robots}.ts`, `app/{termos-de-uso,privacidade}/page.tsx`, `components/tools/financing/{FinancingTool,FinancingForm}.tsx`, `__tests__/seo/seo-rules.test.ts`, `.env.example`, `.gitignore`, `package.json` e `package-lock.json`.

## Resultado consolidado da validação

- Imóveis: 22 testes funcionais aprovados (15 de banco/API/imagens/SEO e sete de interface); uma fixture visual opcional fica ignorada por padrão e também foi executada com sucesso separadamente.
- Execução dirigida com SEO, categorias, financiamento, navegação administrativa e busca global: sete arquivos, 469 testes aprovados e uma fixture visual opcional ignorada. HomeSearch/MobileHome/busca global também passaram em execução específica (22 testes). Inclui validação real do PNG Open Graph, permissões de fotos e persistência no Postgres isolado.
- `npm run build`: aprovado, com 253 páginas estáticas e as novas rotas dinâmicas; TypeScript aprovado.
- `npm run lint`: sem erros; sete avisos fora do módulo já existentes no checkout. Lint dirigido dos arquivos novos também aprovado.
- Regressão ampla: 386 arquivos, 4.140 testes aprovados, quatro falhas e uma fixture opcional ignorada. Três falhas foram timeouts em Lotomania, Smart Story Brand e Carousel Automation; as três suítes passaram juntas em repetição com `--maxWorkers=1 --testTimeout=30000 --hookTimeout=30000` (42 testes), sem alterar seus testes ou lógica. A quarta era o teste antigo da busca global, cuja contagem já omitia Viagens; ele foi atualizado para contemplar Viagens e a nova entrada de Imóveis e passou na execução dirigida. Não se afirma que essa primeira execução ampla ficou inteiramente verde.
- Smoke HTTP no Next de produção local: simulador retorna 200 com R$ 500.000,00 preenchidos; cadastro/painel anônimos retornam o redirect de login do App Router; administração anônima retorna 404; APIs privadas e cron recusam acesso sem sessão/segredo; robots inclui o sitemap de Imóveis. O servidor local foi iniciado com confiança de host restrita ao processo de teste, sem editar configurações de produção.
- A origem das mutações usa o host público da requisição e protocolo de proxy, para suportar URLs internas reconstruídas pelo Next; testes cobrem origem válida por proxy e origem externa recusada.
- Revisão visual no navegador: 320, 390 e 1440 pixels; sem transbordamento horizontal nas páginas verificadas. Os filtros ficam recolhidos no celular e visíveis em desktop. Fixtures têm identificação explícita de dados fictícios e não foram enviadas a serviços externos.
- Não houve teste E2E autenticado com Neon/Blob reais, alteração de plano, deploy ou escrita de anúncios no ambiente de produção. Esses passos pertencem à homologação/publicação descrita acima.
