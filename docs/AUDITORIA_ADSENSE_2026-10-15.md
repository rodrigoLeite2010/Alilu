# Auditoria do Alilu para nova revisão AdSense

Data: 15/10/2026. A auditoria não executou commit, deploy ou migração de banco.

## Parecer

Foram corrigidas inconsistências reais de funcionalidade, transparência, navegação e SEO. A mensagem “conteúdo de baixo valor” não informa qual URL motivou a decisão; não é possível atribuir a reprovação a um achado isolado nem garantir aprovação após estas correções.

**Não solicitar nova revisão ainda:** publicar manualmente as correções após revisão do diff, conferir o painel AdSense e validar os recursos autenticados/remotos com uma conta de teste. A auditoria anônima não comprova publicação no Instagram, entrega dos provedores de IA, pagamento ou atendimento do e-mail. Os resultados finais de testes e navegação estão relacionados abaixo.

## Escopo e recursos usados

- Três subagentes disponíveis: SEO/AdSense, conteúdo/transparência e funcionalidade/UX. Não foram usados agentes ou skills fictícios de SEO.
- Next.js 16.3.5 e React 19.2.8; guias da versão instalada lidos antes das mudanças. A skill computer-use foi consultada para avaliar a inspeção visual; a inspeção efetiva usou Playwright/Chrome do runtime disponível. Nenhuma skill Sites foi aplicada: o trabalho é manutenção deste repositório, sem migrar hospedagem.
- Inspeção de 125 ferramentas ativas, 10 categorias, páginas institucionais e famílias financeiras, Instagram, loterias e vídeos.
- HTTP anônimo em **206 endereços locais e os mesmos 206 publicados**, incluindo login e telas que apresentam gate de conta, robots, sitemap, ads.txt, redirect antigo e uma URL inexistente de controle. URLs internas de erro do framework não são páginas públicas. APIs e painéis administrativos não foram acionados pela varredura.
- Templates com ID/token estão no inventário JSON e foram analisados por código; não foram usados identificadores reais nem fabricados para simular validação autenticada.
- Sem leitura manual de `.env`, acesso ao painel AdSense/Search Console ou criação de conta/pagamento. Build e servidor usam a configuração normal do projeto; no processo local de validação foi definido `AUTH_TRUST_HOST=true`, sem alterar autenticação no código.

## Exigências formais e recomendações

| Tema | Classificação e conclusão |
| --- | --- |
| Anúncios em telas sem conteúdo, em construção ou de baixo valor | Proibição formal de inventário. Não equivale a uma quantidade mínima de palavras. [Política](https://support.google.com/publisherpolicies/answer/11112688?hl=en). |
| Conteúdo copiado/incorporado sem comentário, curadoria ou valor adicional | Proibição formal. Não foi demonstrado plágio nas ferramentas; compartilhar template/código não prova conteúdo replicado. Importações e publicações de usuários exigem cuidado com direitos. [Política](https://support.google.com/publisherpolicies/answer/11190248?hl=en). |
| Conteúdo em escala para manipular busca | Política de spam da Pesquisa; não é uma cota de páginas AdSense. 125 ferramentas ou 19 conversores Base64 não constituem violação por contagem. [Search Central](https://developers.google.com/search/docs/essentials/spam-policies#scaled-content). |
| Valor original, finalidade clara e navegação útil | Orientação oficial de preparação/qualidade. Uma ferramenta que resolve uma tarefa pode oferecer valor sem artigo longo. [Páginas prontas](https://support.google.com/adsense/answer/7299563?hl=en-419), [site reprovado](https://support.google.com/adsense/answer/12176698?hl=en). |
| ads.txt | Recomendado, não obrigatório para aprovação; não é explicação comprovada da rejeição. Criado com o publisher já existente. [Google](https://support.google.com/adsense/answer/12171612?hl=en-GB). |
| Posição de anúncios | Evitar confusão com menus, download e controles. Não há unidades manuais no código; Auto Ads depende do painel. [Posicionamento](https://support.google.com/adsense/answer/1282097?hl=en). |
| Loterias | A política distingue material educativo de participação em apostas e traz regras territoriais. O código de um gerador não prova violação. Não foram removidas modalidades nem aplicado noindex genérico. [Restrição oficial](https://support.google.com/publisherpolicies/answer/10437963?hl=en). |

Não foi adotado mínimo obrigatório de páginas, palavras, visitas ou prazo de espera. Não foi identificado nas fontes consultadas um desses números como requisito universal para aprovação.

## Diagnóstico priorizado

| Prioridade | Evidência comprovada antes da correção | Correção e efeito |
| --- | --- | --- |
| P0 | Gerador sem repetição materializava todo intervalo de até um bilhão de números; uma entrada permitida podia esgotar a memória da aba. | Amostragem de intervalo virtual, com memória proporcional ao lote; limites inteiros seguros. Não foi constatado um conjunto de páginas públicas retornando 500. |
| P1 | Sobre/Termos e categoria Vídeos tratavam serviços com conta, plano e créditos como gratuitos e sem cadastro. | Distinção explícita de ferramentas públicas, processamento remoto, conta, plano e créditos. |
| P1 | Privacidade descrevia principalmente cálculos locais e Instagram; omitia várias persistências/IA e tratava identificação associada à conta como anônima. | Política alinhada aos fluxos encontrados, incluindo conta, dados salvos, mídia, IA, PostHog, cookies, AdSense e contato. Não foram inventados prazos de retenção ou dados de empresa. |
| P1 | FAQ de legibilidade negava envio ao servidor apesar da reescrita opcional com IA. | Separadas análise local e reescrita remota; aviso antes do envio. |
| P1 | Token de convite de amigo secreto podia integrar o caminho enviado ao PostHog/referrer. | Mascaramento do segmento sensível em URLs e propriedades automáticas conhecidas do SDK; autenticação preservada. |
| P1 | Duas páginas de vídeo já noindex, com gate de conta, apareciam no sitemap. Login dependia só de Disallow. | Publicação e indexabilidade separadas no catálogo de vídeo; sitemap exclui essas duas URLs; login recebe noindex rastreável. |
| P1/P2 | A home mobile ocultava o catálogo editorial desktop, sem H1 visível, priorizando Instagram e vídeos. | Apresentação explícita, categorias e links diretos para utilitários/PDF/financiamento. Área de usuários logados preservada. |
| P2 | Validador IE prometia comprimento por UF, mas aceitava o intervalo geral 8–14. | Promessa corrigida na interface, catálogo e FAQ; não foi inventado algoritmo estadual. |
| P2 | 20/11 era contado como feriado nacional inclusive antes da vigência aplicável. | Nacional a partir de 2024; testes de 2023 e 2024. [Lei 14.759/2023](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm). Feriados locais anteriores continuam fora do escopo nacional. |
| P2 | Diálogos permitiam que Tab saísse para o fundo; pedido automático de sugestão cobria o conteúdo. | Retenção de Tab/Shift+Tab nos dois diálogos; sugestão inicia como botão compacto, sem promessa de desenvolvimento “em instantes”. Incluído link para pular navegação. |
| P2 | Caixas vazias “Espaço publicitário” ocupavam as ferramentas. | Slot sem unidade deixa de renderizar; publisher e loader AdSense preservados. |
| P2 | Educação financeira era principalmente um catálogo de áreas privadas. Financiamento principal tinha pouco exemplo aplicado. | Exemplo público de orçamento e passos úteis; exemplo Price com veículo de R$60 mil, entrada de R$10 mil, 24 meses a 1% e custos excluídos. Financiamento permanece indexável. |
| P2 | Lotofácil enfatizava “testes do projeto” em vez de explicar a condição ao visitante. | Exemplo de 18 dezenas/6 jogos/13 acertos condicionais, diferença de cobertura e custo e ausência de garantia de prêmio. |
| P2 | Fallback das cinco modalidades ocupava uma linha, substituída pelo gerador alto após hidratação. | Espaço inicial reservado conforme dimensões medidas do gerador; ver comparação de CLS na validação visual. |

**Hipóteses, não fatos demonstrados:** conteúdo curto e dispersão entre muitas categorias podem enfraquecer a percepção de especialização; inconsistências de promessa/entrega e home mobile pobre podem contribuir para baixo valor. Não foi comprovado que uma delas, a falta de ads.txt ou determinada modalidade de loteria causou a rejeição. Preservaram-se as URLs e o financiamento; não se tentou esconder o catálogo com noindex em massa.

## Inventário por URL e conteúdo

- [Matriz editorial: 125 ferramentas, 10 categorias e demais famílias](auditoria-adsense-conteudo.md).
- [Todas as URLs locais, HTTP e achados mecânicos](auditoria-adsense/local-urls.md) e [comparação publicada](auditoria-adsense/publicado-urls.md).
- JSONs ao lado dessas tabelas contêm title, description, canonical, robots, H1–H3, links e tamanho do conteúdo principal. Tamanho não foi usado como nota de qualidade.
- [SEO/AdSense](auditoria-adsense-seo.md) e [funcionalidade/acessibilidade](auditoria-adsense-funcionalidade.md) detalham os achados e arquivos envolvidos.

Para as 125 ferramentas, o catálogo tem finalidade, componente e entrada editorial específica. Todas permanecem recomendadas à indexação enquanto funcionais; não foi demonstrada duplicação integral. Ter texto e componente não comprova todos os formatos de arquivo/resultados. A matriz identifica exemplos ausentes como curadoria P2, sem produzir textos em massa. Validadores são verificações de formato/dígito, não consultas cadastrais. Conversores PDF/Office têm perdas e limites descritos; verificar arquivos reais complexos continua necessário.

Nas famílias privadas, login é comportamento esperado: financeiro pessoal, dados de conta, automação, histórico de jogos/mídias. Não foram classificados como ferramentas públicas quebradas. As duas telas privadas de criação do calendário marcadas automaticamente como “H1 ausente” são redirecionamentos para login e não entram no sitemap; não são lacuna editorial pública.

O site possui Sobre, Contato, Privacidade, Termos e Exclusão de dados. Cookies e publicidade têm seções na Privacidade, acessível pelo rodapé; não foi criado um documento genérico separado. `contato@alilu.com.br` está presente nas páginas pertinentes; a entrega e o atendimento da caixa não foram comprovados.

## SEO e implementação de anúncios

- 157 URLs no sitemap local: HTTP 200, canonical correspondente e nenhuma noindex; sem duplicatas ou páginas órfãs entre as URLs do sitemap na malha observada. [Validação completa](auditoria-adsense/seo-validation.json).
- Robots permite `/` e aponta para o sitemap correto; áreas privadas/API preservam regras específicas. Google não foi bloqueado globalmente.
- `/utilitarios/financeiro/financiamento-veiculo` continua indexável, com canonical e linkagem interna. A variante com barra final e o slug antigo SAC/Price redirecionam por 308. HTTP e www publicados redirecionam para HTTPS sem www.
- Em produção, ads.txt ainda era 404; na versão corrigida é 200 e usa `pub-2601584178688625`, extraído do loader existente. O código público não confirma se esse publisher está autorizado no painel.
- Loader AdSense único no layout, sem unidades manuais `ins.adsbygoogle`/push no código. Seu carregamento é global e anterior à interatividade; permaneceu para não comprometer verificação válida. Há custo de JavaScript de terceiros mesmo sem unidades manuais. Auto Ads, exclusões e consentimento precisam de verificação no painel.
- Breadcrumbs e FAQ estruturados existentes foram preservados. Schema não garante resultado enriquecido ou aprovação.

## Testes e performance

Os arquivos de evidência estão em `docs/auditoria-adsense/`; tempos e medidas são amostras deste computador, não métricas de usuários reais.

- Build de produção concluído; log `build.log`.
- Lint geral final: código de saída 0, zero erros, sete avisos preexistentes em `carousel-categories-cron.test.ts` e `instagram-account-repository.ts`; log `lint-final.log`. Lint dirigido dos últimos ajustes também terminou com código 0 (`lint-ultimos-ajustes.log`).
- Primeira suíte completa: **335 arquivos passaram, 31 falharam, 1 ignorado; 3.801 testes passaram, 66 falharam, 6 ignorados**, em 950,48 s. Não foi tratada como aprovação.
- Repetição dos 31 arquivos com dois workers, hookTimeout=30s e testTimeout=20s: **28 arquivos passaram; 518 testes passaram e 3 falharam**. Removidos os timeouts de inicialização e a ausência do FFmpeg Windows, restaram três expectativas a investigar. Logs e JSON preservados em `tests-repeticao.*`.
- O FFmpeg Windows estava ausente em `node_modules`; a rotina de instalação do próprio pacote existente restaurou `ffmpeg.exe`. Alteração apenas no ambiente ignorado, sem mudar dependências/lockfile. Testes reais de vídeo voltaram a executar.
- Testes focados de regressão cobrem sitemap/login, aleatoriedade, sorteio grande, calendário histórico, analytics, diálogos e aviso de sugestão. As mudanças em expectativas antigas de teste são descritas na conclusão de validação, sem alterar contratos de produto para “fazer passar”.
- Navegador Chrome em 390×844 e 1440×1000: home, financiamento, PDF, contador, Lotofácil, vídeos e Privacidade. Financiamento de R$50 mil a 1% em 24 meses produz R$2.353,67; união de dois PDFs gera download conferido com duas páginas; contador retorna duas palavras em “Olá mundo”; Lotofácil gera combinação. Sem rolagem horizontal ou erro de JavaScript nas amostras. [Resultados](auditoria-adsense/browser.json).
- Antes de reservar altura, CLS de laboratório da Lotofácil chegou a 0,207 no celular e 0,107 no desktop. Depois, caiu para **0,00052 no celular e 0,00016 no desktop**. A home final teve CLS de 0,0084/0,00084 e LCP de 748/564 ms (celular/desktop). São amostras locais sem limitação de rede/CPU, não CWV de campo.
- A observação de eventos de interação do laboratório não substitui INP de campo. Não há evidência disponível de CrUX/Search Console para declarar aprovação em Core Web Vitals. Cache, rede, CPU e scripts de anúncio variam os resultados.
- Imagens de identidade têm dimensões declaradas; não foi feita alteração visual da marca. Continuam oportunidades de reduzir bytes da logo e custo do loader de anúncios. Não foi aplicada reescrita ampla do registro de ferramentas sem medir benefício e risco.

## Pendências e checklist da nova revisão

1. Revisar diff e publicar manualmente este conjunto. Sem publicação, o Google continuará avaliando a versão anterior.
2. Conferir publisher, propriedade, ads.txt e estado do site no AdSense. Se houver Auto Ads, revisar exclusões de login, conta, erros e telas sem conteúdo e o posicionamento próximo a gerar/baixar/enviar. Não simular cliques ou anúncios.
3. Validar com conta de teste: salvar dados, exportações complexas, uploads, importação autorizada, IA e publicação/agendamento. Não testar com cobranças/créditos reais inadvertidamente. A auditoria não alterou cobrança, integração externa nem banco.
4. Confirmar responsável/controlador, fornecedores efetivamente ativos, retenção/backups, exclusão e funcionamento do e-mail. A política descreve código observado; rotinas operacionais não podem ser inventadas.
5. Conferir requisitos de consentimento conforme países atendidos e configuração efetiva de publicidade/analytics. Não há CMP implementada nesta alteração e não se afirma que a política, sozinha, atende todas as obrigações aplicáveis.
6. Rodar a verificação HTTP/SEO contra o deploy e inspecionar home, financiamento e instituições no Search Console. Checar o que o Google renderiza, não só o HTML local.
7. Medir LCP/CLS/INP de campo e repetir laboratório em celular com rede/CPU limitadas. Preservar a amostra corrigida de CLS como ponto de comparação.
8. Manter curadoria dos exemplos, limitações, referências trabalhistas/tributárias e feedback. A ausência de exemplo em uma ferramenta simples não exige texto longo ou remoção de índice.
9. Solicitar nova revisão somente após validar os itens relevantes e confirmar ausência de falhas públicas. A aprovação final é do Google.

## Arquivos alterados

Lista completa no arquivo [arquivos-alterados.txt](auditoria-adsense/arquivos-alterados.txt), gerado da comparação com `065fbba` e arquivos novos. Inclui páginas institucionais, home/mobile, loterias, conteúdo/avisos de ferramentas, SEO, amostragem aleatória, calendário, analytics, diálogos, testes, scripts e relatórios. O histórico mudou durante a execução: `972ab4c` incorporou parte destas mudanças por uma ação externa aos comandos desta auditoria. Esse commit foi preservado; não foi criado, alterado ou desfeito por esta auditoria. Nenhum deploy foi executado por ela.

## Conclusão da validação final

As três falhas persistentes foram investigadas e corrigidas nos testes, sem modificar contratos ou regras do produto:

- Cron Instagram: a resposta vigente inclui `tokens: null` quando a renovação falha. O teste agora simula essa falha explicitamente e verifica a autorização; 8/8 passaram (`instagram-cron-final.log`).
- Amigo secreto: o teste proibia por engano um par recíproco legítimo. Agora verifica os dois destinos possíveis e a ausência de identidade não autorizada fora do campo do amigo sorteado; 37/37 passaram (`secret-santa-final.log`).
- FFmpeg: o helper contava pacotes de áudio como quadros em framemd5. O mapeamento explícito de vídeo corrige a medição; 3/3 passaram, com processamento real (`videos-ffmpeg-final.log`).

Assim, todos os 31 arquivos que falharam inicialmente passaram nas repetições. A primeira execução integral e as rodadas focadas estão documentadas separadamente; não se apresenta a soma de testes repetidos como um total único, nem se afirma que uma segunda suíte integral foi executada. O build final e os 14 casos de navegador passaram. Nenhum erro HTTP inesperado foi detectado nas 206 URLs locais; sitemap/robots/canonical/ads.txt foram revalidados após as alterações.

**Estado técnico:** correções locais implementadas e verificadas, sem defeito público crítico ainda confirmado nesta amostra. **Estado para nova revisão:** aguardar publicação manual e conferências operacionais/painel listadas no checklist. Não se pode declarar o site publicado integralmente pronto apenas por build e testes locais. CWV de campo, integrações autenticadas e configurações da conta Google continuam sem comprovação nesta auditoria.
