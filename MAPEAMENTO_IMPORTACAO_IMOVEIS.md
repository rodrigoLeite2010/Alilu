# Mapeamento de importação de imóveis — campos, transformações e formatos

## Formatos aceitos

| Formato | Como é lido | Opções |
| --- | --- | --- |
| CSV | UTF-8 (com/sem BOM) ou Windows-1252; RFC 4180 (aspas, quebras de linha) | Separador automático ou `;` `,` tab `|`; cabeçalho na 1ª linha não vazia |
| Excel `.xlsx` | Leitor próprio (jszip); usa o valor em cache das células, **nunca executa fórmulas** | Escolha da aba |
| JSON | Array de imóveis ou objeto com coleção (detectada ou informada, ex. `dados.imoveis`) | Caminho da coleção |
| XML / VRSync | Parser sem DTD, namespaces removidos | Elemento de cada imóvel (VRSync: `Listing`; demais: detectado) |

Estruturas aninhadas são "achatadas" em caminhos: `Details.ListPrice.#text`, `Location.State.@abbreviation`, `imagens[].url`. Arrays viram listas de valores.

## Campos do Alilu

| Campo | Obrigatório | Público? | Transformação |
| --- | --- | --- | --- |
| Código externo | Sim | Não | Até 120 caracteres; chave parceiro + código |
| Título | Não | Sim | HTML removido; < 10 caracteres → gerado ("Casa à venda em Urbanova"); > 120 → truncado |
| Descrição | Não | Sim | HTML removido; < 40 caracteres → gerada das características; omitida se o parceiro não autorizou reutilizar descrições |
| Finalidade | Sim | Sim | Venda / Aluguel / Temporada. Aceita "For Sale", "For Rent", "Locação", "Sale/Rent" (→ Venda com aviso) e conversões personalizadas |
| Tipo | Sim | Sim | Casa, Apartamento, Terreno, Chácara, Cobertura, Kitnet, Sala comercial, Galpão, Outro. Ex.: "Residential / Apartment" → Apartamento; "Residential / Condo" → Casa + "Condomínio fechado"; desconhecido → Outro (aviso) |
| Condição | Não | Sim | Novo / Usado / Em construção ("Lançamento", "Na planta") |
| Preço | Sim | Sim | `850.000,00`, `850000.00`, `R$ 1.200`; opção "em centavos"; 2 casas |
| Valor de aluguel | Não | Sim | Usado como preço quando a finalidade é Aluguel/Temporada |
| Condomínio / IPTU | Não | Sim | Mesmo parser monetário |
| Estado | Sim | Sim | Sigla ou nome ("São Paulo" → SP) |
| Cidade / Bairro | Sim | Sim | Espaços normalizados |
| Endereço, CEP, latitude, longitude | Não | **Não** | Somente no bloco cifrado; hash do endereço para duplicidade |
| Quartos, suítes, banheiros, vagas | Não | Sim | Inteiros 0–100 (decimais arredondados com aviso) |
| Área total | Sim* | Sim | m²; "ha"/hectares × 10.000; *usa a área útil se ausente |
| Área útil | Não | Sim | idem |
| Características | Não | Sim | Separadas por `;` `|` ou quebra de linha; aliases (Pool → Piscina, BBQ → Churrasqueira, Gourmet → Área de lazer, Furnished → Mobiliado, Pets Allowed → Aceita animais); sem correspondência → aviso |
| Fotos | Recomendado | Sim | Somente https, dos domínios autorizados do parceiro; vídeos descartados; até 20; separador configurável ou automático |
| Link original | Recomendado | Via botão | http/https público, sem credenciais/IP; omitido se o parceiro não autorizou |
| WhatsApp do anúncio | Não | Via botão | Só aceito se o parceiro permitir contato por anúncio; senão usa o WhatsApp comercial do cadastro |
| Status | Não | — | Ativo (padrão) · Inativo/Suspenso/Removido → pausado · Vendido · Alugado |
| Vídeo | Não | Sim | Somente YouTube (mesmo validador do cadastro direto) |

Valores padrão por campo são aplicados quando o registro não traz valor.

## Mapeamento automático (exemplos)

| Origem | Campo |
| --- | --- |
| `CodigoImovel`, `codigo`, `ListingID`, `listing_id`, `referencia` | Código externo |
| `Valor`, `preco`, `ListPrice`, `sale_price` | Preço |
| `RentalPrice`, `valor_aluguel` | Valor de aluguel |
| `TransactionType`, `finalidade` | Finalidade |
| `PropertyType`, `tipo` | Tipo |
| `Bedrooms`, `quartos`, `dormitorios` | Quartos |
| `Garage`, `vagas` | Vagas |
| `LotArea`, `AreaTotal` / `LivingArea`, `AreaUtil` | Área total / útil |
| `Media.Item[]`, `Fotos`, `imagens[]`, `images` | Fotos |
| `DetailViewUrl`, `LinkOriginal`, `source_url` | Link original |

## Resultado da validação por registro

| Ação | Significado |
| --- | --- |
| `new` | Será criado |
| `update` | Já existe para o parceiro; conteúdo ou fotos mudaram |
| `unchanged` | Igual ao último import (renova presença e validade) |
| `remove` | Feed informa indisponível (pausado/vendido/alugado) |
| `invalid` | Erro de campo obrigatório ou conversão — nunca publicado |
| `duplicate-in-file` | Código repetido no mesmo arquivo |

"Pendente" (bloqueio de publicação): sem fotos autorizadas; sem link e sem WhatsApp; parceiro sem CRECI válido.

## Modelos para parceiros

Servidos em `/imoveis/modelos/` (gerados por `npx tsx scripts/generate-imoveis-modelos.ts`):

- `MODELO_IMPORTACAO_IMOVEIS.xlsx` — abas *Imoveis* (cabeçalho + 2 exemplos fictícios) e *Instrucoes*
- `MODELO_IMPORTACAO_IMOVEIS.csv` — separador `;`, UTF-8 com BOM
- `EXEMPLO_IMPORTACAO_IMOVEIS.json`
- `EXEMPLO_IMPORTACAO_IMOVEIS.xml` — estrutura VRSync
