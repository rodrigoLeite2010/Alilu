# Carrossel Inteligente — categorias, planejador e diagnóstico

## Fluxo (igual para "Gerar exemplo", execução manual e cron)
`previewSmartCarousel` / `runContentAutomationCron` → `prepareSmartCarousel` → **planejador** (etapa 1: categoria + tema + estrutura + convite) → `generateCarouselProject` (etapa 2: pesquisa → ganchos → roteiro → legenda → fotos → artes) → `publishCarousel`.

## Configuração (`content_automations.smart_carousel_config`)
- `topicSource`: `AUTO` (padrão; a Alilu escolhe categoria e tema, o prompt do Piloto é só orientação de estilo) ou `PROMPT` (modo antigo: o texto do prompt é o tema).
- `enabledCategories` / `categoryWeights` (0–100): 19 categorias; Criação de conteúdo é só uma (peso 5 de 143).
- `avoidCategoryWindow` (3), `avoidTopicWindow` (15), `minPhotos`/`maxPhotos` (3/5).
- Automações antigas, sem esses campos, viram `AUTO` com todas as categorias e pesos padrão.

## Anti-repetição
Categoria (últimas 3), tema (últimos 15, por similaridade), estrutura narrativa e convite final (últimos 2). Se não houver opção, a janela de categorias é reduzida e o aviso fica em `plan.relaxed`; banco esgotado reaproveita o tema menos recente.

## Diagnóstico
Cada geração grava no log (`console.info`) e em `carousel_projects.generation_meta` uma linha `CarouselGeneration / Category / Topic / RecentCategories / RecentTopics / PromptSource / PromptOverride / Provider / Model / FinalPromptChars / CreatorBias / ImagesSelected / ImageIds / TemplatesSelected …`, além da `directive` enviada. Sem chaves nem tokens. O "Gerar exemplo" mostra a linha no painel.

## Imagens
Entre `minPhotos` e `maxPhotos` fotos por carrossel (mais em temas emocionais, menos em conceituais), nunca no último slide, busca por slide (`imageQuery` em inglês, 3–5 palavras) com cena da categoria como reserva, cache de buscas (`carousel_photo_search_cache`, 7 dias) e sem repetir fotos dos últimos carrosséis.

Migração: `0043_carousel_generation_meta.sql` (`npm run db:migrate`).
