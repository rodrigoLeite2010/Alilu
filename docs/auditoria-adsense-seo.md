# Auditoria técnica de SEO e AdSense — 15/10/2026

## Evidências e correções

| Prioridade | URL/escopo | Evidência anterior | Correção |
| --- | --- | --- | --- |
| P1 | `/videos/imagem-para-video`, `/videos/importar-instagram` | As páginas exportam `robots.index: false` e exibem login ao visitante, mas `app/sitemap.ts` incluía todos os vídeos ativos. | Campo `indexable` explícito em `data/videos.ts`; essas duas páginas continuam disponíveis, sem aparecer no sitemap. |
| P1 | `/entrar` | A página cliente não tinha metadados próprios e dependia apenas do `Disallow` em robots.txt. Bloqueio de rastreamento não garante exclusão do índice. | Layout servidor com `noindex, follow`; liberado o rastreamento dessa tela para que Google consiga observar a instrução. Nenhum fluxo de autenticação alterado. |
| P2 | `/ads.txt` | Nenhum arquivo público ou rota correspondente no repositório. | Criado com o publisher já presente no layout: `pub-2601584178688625`. Recomenda-se confirmar autorização no painel depois da publicação. |

A calculadora `/utilitarios/financeiro/financiamento-veiculo` continua publicada, indexável, com canonical próprio e presente no sitemap. Nenhuma URL de ferramenta foi removida nem redirecionada nesta alteração.

## Aspectos existentes adequados

- Metadados e canonical absolutos centralizados em `lib/seo/metadata.ts`, com origem normalizada em `lib/seo/site.ts`.
- Ferramentas marcadas como `em-breve` usam noindex e ficam fora do sitemap; ferramentas ativas têm componentes e conteúdo verificados pelos testes existentes.
- Páginas de ferramentas usam Server Components, com H1, descrições e conteúdo explicativo renderizados no servidor; a interatividade fica nos componentes clientes. Não foi encontrada opção `ssr: false` no registro das ferramentas.
- O redirecionamento permanente do antigo slug `sac-x-price` para `financiamento-sac-price` já existe em `next.config.ts`.
- BreadcrumbList e FAQPage são gerados a partir do conteúdo exibido. Isso não implica elegibilidade nem promessa de resultados enriquecidos.

## AdSense: evidências e limites

`app/layout.tsx` contém um único loader `adsbygoogle.js` com `ca-pub-2601584178688625`, carregado por `next/script` no layout raiz. Não foram encontradas unidades manuais `ins.adsbygoogle` nem chamadas `adsbygoogle.push`. O componente `AdSlot` é apenas um bloco visual, sem anúncio real. A existência do loader não prova que Auto Ads estejam desligados: essa configuração está no painel da conta, ao qual esta auditoria não teve acesso. Verificar exclusões de páginas privadas, login, páginas em construção e páginas sem conteúdo antes de ativar anúncios. Não foi constatado clique acidental em anúncio real a partir do código disponível.

O loader global com `beforeInteractive` tem prioridade alta, inclusive nas áreas privadas. Foi preservado para não alterar uma configuração de verificação válida sem conhecer o painel. A documentação oficial permite verificar propriedade por metatag ou ads.txt; uma mudança futura pode separar verificação e carregamento de anúncios, depois de confirmar o método utilizado na conta.

`ads.txt` é recomendado pelo Google e **não obrigatório**. Sua ausência não comprova a causa da reprovação por conteúdo de baixo valor. Tampouco existem nas fontes consultadas um mínimo universal de palavras, visitas ou páginas para aprovação.

## Outras observações

- A home ocultava o conteúdo editorial desktop em telas menores que 768px e usava uma home mobile concentrada em Instagram e vídeos, com acesso às demais ferramentas por um modal. Isso é evidência de diferença de experiência; a influência sobre a reprovação é hipótese, não causa demonstrada. O trabalho na home está registrado no relatório geral.
- `/instagram/carrossel-inteligente/planos` é indexável e possui canonical, mas está fora do sitemap. A inclusão é uma oportunidade secundária, condicionada ao valor e à estabilidade da página; não foi aplicado noindex.
- Páginas privadas autenticadas permanecem protegidas por autenticação e regras existentes. Robots.txt não substitui controle de acesso.
- A ferramenta web não conseguiu acessar produção em `/robots.txt`, `/sitemap.xml`, `/ads.txt` e na calculadora de veículos; esses erros da ferramenta não demonstram indisponibilidade do site. Validar o HTML publicado e Search Console depois de publicar manualmente as correções.

## Fontes oficiais consultadas

- [Conteúdo ausente ou de baixo valor](https://support.google.com/publisherpolicies/answer/11112688?hl=en): proibição de veicular anúncios em telas sem conteúdo do editor, de baixo valor ou em construção.
- [Políticas para editores](https://support.google.com/adsense/answer/10502938?hl=en).
- [Guia ads.txt](https://support.google.com/adsense/answer/12171612?hl=en-GB): recomendação, formato e caráter não obrigatório.
- [noindex e rastreamento](https://developers.google.com/search/docs/crawling-indexing/block-indexing): o crawler precisa conseguir acessar a página para ler noindex.
- [Conectar um site ao AdSense](https://support.google.com/adsense/answer/12169212?hl=en): opções de verificação por código, metatag e ads.txt.
- [Código AdSense e Auto Ads](https://support.google.com/adsense/answer/9274634?hl=en).

Antes das alterações foram lidos os guias instalados do Next.js 16.3.5 em `node_modules/next/dist/docs/`: robots, sitemap, generate-metadata, script e Server/Client Components. Esta auditoria não consultou arquivos `.env`.

## Validação

Executado `npx vitest run __tests__/seo/seo-rules.test.ts __tests__/seo/instagram-seo.test.ts`: **417 testes passaram em 2 arquivos**. Os testes de SEO verificam a permanência do editor público no sitemap, a exclusão das duas páginas noindex, a disponibilidade dos vídeos no catálogo e os metadados do login. Build/lint e navegação publicados continuam necessários para concluir a preparação; resultados gerais constam no relatório consolidado. A aprovação é decisão do Google.
