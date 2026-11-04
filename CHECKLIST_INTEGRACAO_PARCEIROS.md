# Checklist — cadastrar um parceiro novo

## Antes do cadastro (documentação)

- [ ] Autorização escrita do parceiro para divulgar a carteira no Alilu (quem assinou, data, validade).
- [ ] Escopo: quais imóveis/cidades, se descrições podem ser reutilizadas, se o link do anúncio original pode ser exibido, se fotos podem ser **copiadas** ou só exibidas.
- [ ] Política de remoção/atualização (prazo para atender pedidos de remoção).
- [ ] CRECI da imobiliária (J) ou do corretor (F) conferido no conselho regional.
- [ ] WhatsApp **comercial** autorizado (nunca número pessoal obtido de terceiros).
- [ ] Domínios de onde vêm as fotos (ex.: `fotos.imobiliaria.com.br`, CDN do CRM).
- [ ] Decisão de indexação: padrão "não indexar"; "indexar" só com conteúdo exclusivo/autorizado.
- [ ] Confirmação de que o parceiro tem autorização dos proprietários para anunciar.

## Cadastro no painel (`/admin/imoveis/integracoes` → Parceiros)

- [ ] Nome, nome fantasia, tipo, CRECI, WhatsApp comercial, e-mail, site, logo (https), cidade/UF.
- [ ] CPF/CNPJ apenas se necessário (fica cifrado).
- [ ] Bloco "Autorização" completo.
- [ ] Domínios autorizados das fotos e política de fotos.
- [ ] Limite de anúncios do parceiro.

## Fonte de importação

- [ ] Upload manual (criado automaticamente) **ou** nova fonte URL/API.
- [ ] Feed completo ou incremental — confirmar com o parceiro.
- [ ] URL https autorizada; token em "Headers" (fica cifrado, não reaparece).
- [ ] Paginação, se houver.
- [ ] Frequência (manual / 6 h / 12 h / diária) e tolerância de ausências (padrão 2).
- [ ] "Publicar automaticamente" desligado até a primeira aprovação.

## Primeira importação

- [ ] Importar arquivo (ou "Sincronizar agora") → revisar o mapeamento sugerido.
- [ ] Conferir a prévia: inválidos, sem preço, sem fotos, sem link, campos ignorados, avisos.
- [ ] Baixar o relatório de erros e enviar ao parceiro, se necessário.
- [ ] Abrir 3–5 imóveis da prévia e comparar com o site do parceiro (preço, fotos, bairro, descrição).
- [ ] Confirmar importação (publicar ou deixar pendente).
- [ ] Ver "Duplicidades" e conferir candidatos.
- [ ] Abrir 2 anúncios publicados: fotos, botão "Ver anúncio original", WhatsApp, aviso de responsabilidade.

## Depois

- [ ] Ligar "Publicar automaticamente" na fonte, se desejado.
- [ ] Acompanhar "Logs e erros" e "Prévias e sincronizações" nas primeiras execuções do cron.
- [ ] Registrar pedidos de remoção (API `parceiros/:id/remocao`) e agir: suspender parceiro (oculta tudo) ou suspender anúncios selecionados.
- [ ] Revisar a validade da autorização — vencida, a sincronização para automaticamente.
