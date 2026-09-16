# ALILU UTILITÁRIOS

Plataforma brasileira de calculadoras e utilitários gratuitos para web
(domínio de produção: `https://alilu.com.br`). Prioriza SEO, performance e
experiência mobile, funcionando como uma "caixa de ferramentas" — não um
blog.

O processo completo do projeto (visão de produto, princípios de arquitetura,
regras de SEO/performance/acessibilidade, fluxo de trabalho entre etapas e o
papel de cada agente de IA) está documentado em
[`docs/PROMPT_MESTRE_ALILU.md`](docs/PROMPT_MESTRE_ALILU.md). Este README
cobre apenas o dia a dia de desenvolvimento.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- React 19
- Tailwind CSS 4 (configuração via `@theme` em CSS, sem `tailwind.config.js`)
- ESLint (`eslint-config-next`)
- Vitest + Testing Library para testes automatizados

> Esta versão do Next.js é recente e traz mudanças relevantes em relação a
> versões anteriores. Antes de programar, consulte `node_modules/next/dist/docs/`
> (ver nota em `AGENTS.md`).

## Requisitos

- Node.js 20+
- npm

## Instalação

```bash
npm install
```

## Rodando localmente

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Sobe o build de produção |
| `npm run lint` | Roda o ESLint |
| `npm test` | Roda a suíte de testes (Vitest) uma vez |
| `npm run test:watch` | Roda os testes em modo watch |

## Estrutura do projeto

```
app/                      Rotas (App Router): home, /utilitarios, categorias,
                          ferramentas, páginas legais, sitemap.ts, robots.ts
components/
  layout/                 Header, Footer, containers de página
  navigation/              Breadcrumbs e navegação
  tools/                  Cards de ferramenta, template de página de ferramenta
  forms/ results/          Blocos reutilizáveis de formulário/resultado
  seo/                    Componentes auxiliares de SEO
  ui/                     Componentes de UI genéricos (Icon, Container, etc.)
lib/
  seo/                    Metadata (metadata.ts), regra de indexação (publish.ts), SITE_URL (site.ts)
  calculators/ formatters/ validators/   Reservados para a lógica das futuras ferramentas
data/
  tools.ts                Catálogo central das ferramentas (única fonte de verdade)
  categories.ts           Catálogo central das categorias
__tests__/                Testes (por área: components, data, lib, seo)
docs/                     Prompt mestre, prompt do auditor e demais decisões do projeto
Prompts/                  Documento original de planejamento (mantido temporariamente, ver docs/PROMPT_MESTRE_ALILU.md)
```

## Catálogo de ferramentas e significado do `status`

Toda ferramenta é um item de `data/tools.ts`, com metadados centralizados
(`id`, `name`, `slug`, `category`, `description`, `keywords`, `icon`,
`relatedTools`, `status`). Nenhum componente deve duplicar esses dados.

O campo `status` tem dois valores possíveis:

- **`"em-breve"`** — a ferramenta aparece no catálogo/cards normalmente, mas
  ainda não tem cálculo implementado. A página continua acessível, porém
  **não deve ser indexada** pelos buscadores nem aparecer no sitemap.
- **`"ativo"`** — ferramenta publicada: indexável, presente no sitemap,
  canonical e Open Graph normais.

## Regra de SEO/indexação (fonte única)

A indexabilidade de cada ferramenta é decidida em **um único lugar**:
[`lib/seo/publish.ts`](lib/seo/publish.ts), a partir do `status` do catálogo.
Nenhuma página ou componente deve reimplementar essa decisão manualmente.

- `isToolPublished(tool)` — `true` somente quando `status === "ativo"`.
- `getPublishedTools(tools)` — filtra a lista de ferramentas publicadas; é o
  que alimenta `app/sitemap.ts` (só ferramentas `"ativo"` entram no sitemap).
- `getToolRobotsMeta(tool)` — retorna `{ index, follow }` para a página da
  ferramenta (`app/utilitarios/[categoria]/[ferramenta]/page.tsx`), via
  `buildPageMetadata` em `lib/seo/metadata.ts`.

**Publicar uma ferramenta nova é uma alteração de uma linha**: trocar seu
`status` de `"em-breve"` para `"ativo"` em `data/tools.ts`. Ela passa a
aparecer no sitemap e a permitir indexação automaticamente, sem tocar em
`sitemap.ts`, na página da ferramenta ou em qualquer outro arquivo.

O comportamento é coberto por testes automatizados em
[`__tests__/seo/seo-rules.test.ts`](__tests__/seo/seo-rules.test.ts).

## Fluxo de trabalho (Claude → Codex → aprovação → commit)

O projeto segue um fluxo de etapas pequenas, com dois agentes de IA com
papéis distintos (detalhado em `docs/PROMPT_MESTRE_ALILU.md` e
`docs/PROMPT_AUDITOR_CODEX.md`):

1. **Claude Code** implementa somente a etapa solicitada, roda lint/testes/build
   e reporta o que mudou. Não faz commit automaticamente.
2. **Codex** audita o estado atual (git status/diff, lint, testes, build),
   procura regressões e problemas de SEO/mobile/performance/segurança, e
   classifica achados em CRÍTICO / ALTO / MÉDIO / BAIXO — sem alterar arquivos.
3. Se aprovado ("APTO PARA CONTINUAR"), o commit é feito manualmente (um
   commit por etapa aprovada). Se houver problemas ("REQUER CORREÇÕES"), o
   Claude corrige apenas o que foi apontado e o ciclo se repete.
4. Só então a próxima etapa é iniciada.

## Variáveis de ambiente

Ver [`.env.example`](.env.example):

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site, usada em metadata (canonical, Open Graph) e no sitemap. Em produção: `https://alilu.com.br`. |

Nenhuma outra variável/credencial é necessária nesta fase (sem backend, sem
banco de dados, sem AdSense ou Analytics reais).

## Como adicionar uma nova ferramenta

1. Adicionar um item em `data/tools.ts` com `status: "em-breve"` (metadados
   completos: `id`, `name`, `shortName`, `slug`, `category`, `description`,
   `keywords`, `icon`, `relatedTools`).
2. Implementar a lógica de cálculo isolada da UI, em `lib/calculators/`, com
   testes cobrindo valores normais, zero, campos vazios, negativos
   inválidos, casas decimais, limites e formatação pt-BR.
3. Construir a interface reutilizando os componentes de `components/tools`,
   `components/forms` e `components/results`, seguindo o padrão visual
   descrito em `docs/PROMPT_MESTRE_ALILU.md` (seção 6).
4. Quando a ferramenta estiver pronta e validada, trocar seu `status` para
   `"ativo"` — isso a torna indexável e a inclui no sitemap automaticamente.
5. Rodar `npm run lint`, `npm test` e `npm run build` antes de reportar a
   etapa concluída.
