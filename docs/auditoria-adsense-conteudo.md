# Auditoria de conteúdo Alilu — 15/10/2026

Escopo: inspeção estática dos catálogos, componentes de ferramenta, textos institucionais e páginas públicas/especiais. A presença de componente e texto não comprova execução funcional de todas as ações. Testes de navegação, arquivos e integrações devem ser combinados com o relatório técnico principal. Nenhum arquivo .env foi lido nesta auditoria.

## Diagnóstico e evidências

- **P1, corrigido:** Sobre e Termos prometiam gratuidade e ausência de cadastro para toda a plataforma. Há serviços de conta, assinatura e créditos. Agora distinguem ferramentas públicas de serviços com conta e condições pagas.
- **P1, corrigido:** Privacidade omitia conta, dados financeiros, mídias remotas, IA, planos e créditos; chamava a identificação de navegação de anônima apesar de associá-la ao usuário. Texto ampliado com base nos fluxos do código, sem inventar empresa, certificação, consentimento ou prazo automático de retenção.
- **P1, corrigido:** Privacidade tratava publicidade apenas como futura apesar de script AdSense integrado. Agora informa integração, possibilidade de cookies e links oficiais Google. A configuração efetiva de anúncios automáticos depende do painel e precisa ser conferida pelo responsável.
- **P1, corrigido:** Categoria Vídeos anunciava todos os três recursos como grátis/sem cadastro. Agora diferencia split-screen público, vídeo IA com conta/créditos e importação com conta/plano/cota.
- **P1, corrigido:** FAQ de legibilidade negava qualquer envio do texto, mas Melhorar com IA envia ao backend/provedor. FAQ e aviso imediatamente antes do recurso explicam a distinção.
- **P2, corrigido:** Educação financeira funcionava sobretudo como catálogo de áreas privadas. Acrescentados exemplo de orçamento com números, passos práticos e acesso a calculadora pública sem conta.
- **Hipótese de qualidade, não causa demonstrada da reprovação:** o catálogo grande cobre várias intenções com conteúdo curto e compartilhado. Isso não constitui automaticamente violação, nem há mínimo oficial de palavras. A prioridade é testar os resultados e tornar exemplos/limitações específicos, sem preencher páginas com texto artificial.

## Matriz das ferramentas públicas

125 ferramentas no catálogo; 125 ativas. Todas possuem entrada específica de conteúdo. A matriz abaixo registra cobertura editorial; não usa quantidade de texto como critério de aprovação. “Sem exemplo identificado” é oportunidade P2 de curadoria contextual, não motivo isolado de noindex. As páginas preservam suas URLs e a estratégia de financiamento.

| URL | Estado | Seções / FAQ | Exemplo identificado no texto | Avaliação editorial |
| --- | --- | --- | --- | --- |
| /utilitarios/trabalho/calculadora-rescisao | ativo; pública | 2 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/trabalho/salario-liquido | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/trabalho/calculadora-ferias | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/trabalho/decimo-terceiro | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/trabalho/hora-extra | ativo; pública | 3 / 2 | Sim | P2: considerar limitação e contexto de uso |
| /utilitarios/financeiro/juros-compostos | ativo; pública | 5 / 6 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/financiamento-veiculo | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/financeiro/financiamento-sac-price | ativo; pública | 5 / 6 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/parcelamento | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/financeiro/quanto-guardar-por-mes | ativo; pública | 2 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/financiamento-veiculos | ativo; pública | 2 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/qual-carro-cabe-no-bolso | ativo; pública | 3 / 4 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/entrada-financiamento-veiculo | ativo; pública | 3 / 3 | Sim | P2: considerar limitação e contexto de uso |
| /utilitarios/financeiro/taxa-juros-financiamento-veiculo | ativo; pública | 3 / 3 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/comparador-propostas-financiamento | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/comparador-prazos-financiamento | ativo; pública | 3 / 3 | Sim | P2: considerar limitação e contexto de uso |
| /utilitarios/financeiro/entrada-maior-x-menor-financiamento | ativo; pública | 3 / 3 | Sim | P2: considerar limitação e contexto de uso |
| /utilitarios/financeiro/antecipacao-parcelas-financiamento | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/cet-estimado-financiamento | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/financiamento-x-a-vista | ativo; pública | 3 / 4 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/financiamento-x-consorcio | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/custo-mensal-carro | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/financeiro/parcela-maxima-pela-renda | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/empresa/gerador-recibo | ativo; pública | 4 / 6 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/empresa/gerador-orcamento | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/empresa/markup | ativo; pública | 3 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/empresa/margem-de-lucro | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/empresa/custo-funcionario | ativo; pública | 2 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/outros/dias-uteis | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/outros/porcentagem | ativo; pública | 3 / 2 | Sim | P2: considerar limitação e contexto de uso |
| /utilitarios/outros/qr-code | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/outros/leitor-xml-nfe | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/outros/divisao-de-despesas | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/outros/numero-do-banco | ativo; pública | 3 / 3 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/unir-pdf | ativo; pública | 4 / 6 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/dividir-pdf | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/comprimir-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/pdf-para-word | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/pdf-para-powerpoint | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/pdf-para-excel | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/word-para-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/powerpoint-para-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/excel-para-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/editar-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/pdf-para-jpg | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/jpg-para-pdf | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/assinar-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/marca-dagua | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/girar-pdf | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/html-para-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/desbloquear-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/pdf/proteger-pdf | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-cpf | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-cnpj | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-cartao-credito | ativo; pública | 3 / 4 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-pis-pasep | ativo; pública | 3 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-renavam | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-cnh | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-titulo-eleitor | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-placa-veiculo | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-senha | ativo; pública | 2 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-numeros-aleatorios | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/sorteador-numeros | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/geradores/gerador-nomes | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-cep | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-rg | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-conta-bancaria | ativo; pública | 2 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-veiculo | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-inscricao-estadual | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-pessoas | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-empresas | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-nicks | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-letras-diferentes | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/simbolos-para-copiar | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-lorem-ipsum | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/geradores/gerador-curriculo | ativo; pública | 2 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-certidao | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/geradores/gerador-imagem | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-cpf | ativo; pública | 3 / 4 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-cnpj | ativo; pública | 3 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-cartao-credito | ativo; pública | 3 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-conta-bancaria | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-certidoes | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-cnh | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-pis-pasep | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-renavam | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-rg | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-titulo-eleitor | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/validadores/validador-inscricao-estadual | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/corretor-ortografico | ativo; pública | 3 / 3 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/ordem-alfabetica | ativo; pública | 2 / 3 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/contador-caracteres | ativo; pública | 2 / 3 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/contador-ocorrencia-palavra | ativo; pública | 2 / 3 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/legibilidade | ativo; pública | 5 / 5 | Sim | P1 corrigido: análise local e IA remota diferenciadas |
| /utilitarios/funcoes-string/texto-para-html | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/cortar-textos | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/dividir-string | ativo; pública | 2 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/informacoes-caractere | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/funcoes-string/inverter-texto | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/funcoes-string/maiusculas-minusculas | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/funcoes-string/numero-por-extenso | ativo; pública | 2 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/funcoes-string/remover-acentos | ativo; pública | 2 / 2 | Sim | P2: considerar limitação e contexto de uso |
| /utilitarios/funcoes-string/remover-quebras-linha | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/rede-internet/meu-ip | ativo; pública | 2 / 2 | Não identificado | P2: considerar limitação e contexto de uso |
| /utilitarios/rede-internet/meu-navegador | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/rede-internet/meu-sistema-operacional | ativo; pública | 2 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-ascii | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-audio | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/basic-auth-decode | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-arquivo | ativo; pública | 3 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-hex | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-imagem | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-pdf | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-texto | ativo; pública | 3 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/base64-para-video | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/audio-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/css-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/arquivo-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/hex-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/html-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/imagem-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/pdf-para-base64 | ativo; pública | 3 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/texto-para-base64 | ativo; pública | 3 / 2 | Sim | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/url-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |
| /utilitarios/conversor-base64/video-para-base64 | ativo; pública | 3 / 2 | Não identificado | Conteúdo específico; revisar resultado no teste funcional |

## Categorias públicas

Cada rota abaixo é gerada pelo catálogo de categorias e possui listagem contextual. Evitar que a categoria repita apenas descrições de cards: a utilidade está em orientar escolha e levar à ferramenta correspondente. Não foi aplicado noindex em categorias ou ferramentas ativas.

- /utilitarios/trabalho: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/financeiro: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/empresa: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/outros: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/pdf: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/geradores: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/validadores: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/funcoes-string: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/rede-internet: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.
- /utilitarios/conversor-base64: categoria pública; descrição e catálogo; links dependem dos registros de ferramentas.

## Páginas e famílias especiais

| URL/família | Acesso real / conteúdo | Gravidade e encaminhamento |
| --- | --- | --- |
| / | Busca, categorias, ferramentas e destaques; mobile usa componente próprio | P2: diferenciar serviços com conta e créditos nas chamadas; validação mobile no relatório principal |
| /utilitarios | Catálogo público de ferramentas | Não é página vazia; conferir busca e acesso a categorias |
| /sobre | Institucional público | P1 corrigido: escopo gratuito, conta, créditos, limitações e contato |
| /contato | Canal público contato@alilu.com.br | Canal correto; não promete equipe, empresa ou atendimento inexistente |
| /privacidade | Política pública | P1 corrigido: escopo de dados/cookies/IA/contas/publicidade; pendências operacionais abaixo |
| /termos-de-uso | Termos públicos | P1 corrigido: conta/planos/créditos, responsabilidade por conteúdo e revisão IA |
| /exclusao-de-dados | Instruções públicas | Solicitação por e-mail; prazo de até 30 dias já declarado no projeto, verificar operação real |
| /financeiro/educacao-financeira | Landing pública; controles dependem de conta | P2 corrigido: exemplo de orçamento e instruções públicas |
| /financeiro/{meu-orcamento,calendario,receitas,despesas,metas,dividas,assinaturas,planejamento-anual,metodo-50-30-20,metodo-envelopes,reserva-de-emergencia,planilhas} | Área pessoal: login exigido pelo componente FinancePage; layout aplica noindex | Não confundir painel com artigo público; testes com conta dependem de acesso autorizado |
| /loterias | Catálogo público de cinco modalidades | Organiza ferramentas; não promete prever resultados |
| /loterias/{lotofacil,mega-sena,quina,lotomania,dia-de-sorte} | Geradores públicos; filtros, instruções, probabilidades e advertências | Composição não muda probabilidade de cada combinação; consultar regras e preços Caixa ao revisar conteúdo |
| /loterias/lotofacil/fechamento | Fechamento público com garantia condicionada | P2 corrigido na integração: exemplo de 18 dezenas, condição, cobertura e custo; nenhuma garantia de prêmio |
| /loterias/{lotofacil,mega-sena,quina,lotomania,dia-de-sorte}/meus-jogos | Histórico associado à conta | Não é resultado oficial nem conferência automática de concurso; validar login/histórico |
| /instagram | Hub público de criação e publicação | Criação local e publicação/automações têm condições distintas |
| /instagram/criar-post | Editor público; download sem login; publicação depende de conta/conexão | Instruções presentes; revisar exportação com mídia de teste |
| /instagram/carrossel | Editor público; publicação depende de conta/conexão | Instruções presentes; não confundir com Carrossel Inteligente pago |
| /instagram/legendas | Gerador público por modelos de texto | Explica que não usa IA e não promete alcance; conteúdo específico adequado |
| /instagram/reels | Composição de Reels | Verificar ações de exportação versus publicação com conexão |
| /instagram/posts-virais | Criação por templates pública; salvar/publicar exige conta e conexão | Nome não garante viralização; não há evidência de IA na página; noindex atual |
| /instagram/{painel,painel/calendario,painel/calendario/novo,painel/calendario/novo-carrossel,conectado} | Operação da conta conectada | Não tratar como conteúdo editorial indexável; testar integração separadamente |
| /instagram/carrossel/repostar | Reutilização/importação de conteúdo | Necessita autorização de uso; não assumir direitos por conteúdo ser público |
| /instagram/carrossel-inteligente e /instagram/carrossel-inteligente/planos | Geração com IA, login e planos | Fora da experiência gratuita sem conta; exige revisão humana antes publicação |
| /instagram/carrossel-inteligente/[id] | Projeto individual | Privado; sem motivo editorial para indexar dados do usuário |
| /instagram/piloto-automatico, /nova, /automacoes/[id], /automacoes/[id]/historico | Automação com conta/plano | Históricos e editores não são conteúdo público; avaliar execução autenticada separadamente |
| /videos | Hub público com três ferramentas | P1 corrigido: badges e FAQ de acesso/custo por recurso |
| /videos/editor-split-screen | Editor público com processamento remoto | Entrada removida após processamento; download e infraestrutura precisam teste real |
| /videos/imagem-para-video | Conta e créditos de IA; noindex | Diferenciar de editor gratuito; geração remota Runway |
| /videos/importar-instagram | Conta, plano/cota; noindex | P1 corrigido no catálogo: não é ferramenta sem cadastro |
| /videos/importacoes-instagram | Histórico pessoal | Conteúdo pessoal, não editorial |
| /agenda | Recurso pessoal com conta | Dados persistidos precisam política e validação autenticada |
| /mesada, /mesada/categorias, /mesada/[id] | Gerenciamento pessoal/familiar | Não confundir dados da conta com cálculos locais descartáveis |
| /amigo-secreto, /amigo-secreto/novo, /amigo-secreto/[id], /amigo-secreto/convite/[token] | Gestão de evento e convite individual | Convites têm acesso específico; não representam artigos públicos |
| /entrar | Autenticação | Página funcional, sem necessidade de produzir texto SEO artificial |
| /planos | Condições comerciais | Revisar valores e elegibilidade na operação; sem modificar cobrança |
| /sugestoes | Lista pública de sugestões recebidas, com noindex | Pode estar vazia; não promete implementação e não deve ser tratada como artigo editorial |
| /minha-conta e /minha-conta/{midias,midia-final,identidade-stories,creditos-ia} | Conta e mídia privada | Não indexar dados pessoais; política agora explica persistência |
| /admin e descendentes | Administração autenticada | Não constituem conteúdo público; fora da avaliação editorial do catálogo |

## Curadoria: onde melhorar sem inflar páginas

1. Ferramentas simples de texto, símbolos e geradores: um exemplo curto de entrada/saída quando isso ajudar; explicar se resultado é Unicode, transformação irreversível ou dado fictício. Não adicionar exemplos artificiais onde a interface já demonstra o resultado.
2. PDFs: os textos existentes já explicam limites importantes (PDF para PowerPoint é visual; Excel sem OCR; assinatura apenas visual; cobertura do editor não remove dados). Preservar essas informações e validar os arquivos produzidos.
3. Financiamento: manter indexável, preservar URLs e diferenças de intenção entre ferramentas. Resultados precisam explicar hipóteses, taxas equivalentes, custos ausentes e comparação de cenários. As páginas têm conteúdo próprio; não se demonstrou duplicação integral.
4. Base64: 19 rotas usam um componente configurável, mas diferem em formato, validação e intenção. Compartilhar código não prova conteúdo de baixo valor. Revisar limites de arquivo, MIME e restrições CORS da conversão por URL.
5. Geradores e validadores: uso de dígito verificador não comprova identidade/cadastro real. Não promover dados sintéticos como documentos ou contas utilizáveis. O gerador de cartão já explica sandbox/Luhn e não gera CVV ou validade.
6. Loterias: evitar impressão de vantagem estatística. Uma combinação mantém a mesma probabilidade; conjuntos com mais combinações têm cobertura/custo diferentes. A classificação de conteúdo restrito e elegibilidade de anúncios exige documentação Google e painel de políticas, não suposições.

## Pendências antes da nova revisão

- Confirmar com o responsável a identificação do controlador, os fornecedores ativos, prazos de retenção de mídia/backups, procedimentos de exclusão e atendimento do e-mail. O código não comprova essas rotinas externas e a auditoria não inventa dados cadastrais.
- Conferir no painel AdSense o modo de anúncios (incluindo automáticos) e eventual limitação de inventário nas páginas de loteria. O script integrado não comprova anúncio real exibido.
- Avaliar necessidade e implementação de controles de privacidade/consentimento conforme público e configuração efetiva. Esta alteração não implementa banner nem promete consentimento inexistente.
- Executar as ferramentas com arquivos/cenários reais e contas de teste, em especial APIs remotas, exportação Office/PDF, geração IA, importações e publicação. A matriz não declara todas as ações testadas.
- Repetir curadoria priorizando defeitos e dúvidas dos usuários; não adotar mínimo de palavras, visitas ou páginas como requisito formal.

## Arquivos editoriais alterados por esta auditoria

- app/sobre/page.tsx
- app/termos-de-uso/page.tsx
- app/privacidade/page.tsx
- app/videos/page.tsx
- app/financeiro/educacao-financeira/page.tsx
- components/tools/tool-content.tsx
- components/tools/legibilidade/RewritePanel.tsx

Lint direcionado nos sete arquivos editoriais passou. A execução direcionada dos testes existentes de catálogos, rota de reescrita e serviço de reescrita obteve 35/36 casos: uma inicialização PGlite no beforeEach excedeu o hookTimeout de 10 segundos; não foi falha de asserção do comportamento. A repetição isolada de readability-rewrite.test.ts com um worker e hookTimeout de 30 segundos passou nos 13/13 testes, em 82 segundos; nenhum teste foi alterado. Build, lint geral, testes e inspeção visual integram a validação coordenada do relatório principal. Nenhuma aprovação AdSense pode ser prometida por estas mudanças.
