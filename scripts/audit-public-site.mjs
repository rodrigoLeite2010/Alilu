// Read-only HTTP audit. Run after `next build` and `next start`.
// node scripts/audit-public-site.mjs http://localhost:3100 local
import fs from 'node:fs/promises';
import path from 'node:path';

const origin = new URL(process.argv[2] || 'http://localhost:3100').origin;
const label = process.argv[3] || 'local';
if (!/^[a-z-]+$/.test(label)) throw new Error('Use a simple report label');
const templates = [];
async function pages(dir) {
  const routes = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) routes.push(...await pages(file));
    if (entry.name === 'page.tsx') {
      const segments = path.relative('app', dir).split(path.sep).filter(s => s && !s.startsWith('('));
      const route = '/' + segments.join('/');
      if (segments.some(s => s.startsWith('['))) templates.push(route);
      else if (!route.startsWith('/admin')) routes.push(route);
    }
  }
  return routes;
}
const manifest = JSON.parse(await fs.readFile('.next/prerender-manifest.json', 'utf8'));
const routes = [...new Set([
  ...await pages('app'), ...Object.keys(manifest.routes).filter(s => !/\.(png|ico)$/.test(s) && !s.startsWith('/_')),
  '/ads.txt', '/utilitarios/financeiro/sac-x-price', '/auditoria-rota-inexistente',
])].sort();
const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
const rows = [];
let cursor = 0;
async function inspect(route) {
  const start = performance.now();
  try {
    const response = await fetch(origin + route, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
    const html = await response.text();
    const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const tags = [...body.matchAll(/<(?:meta|link)\b[^>]*>/gi)].map(m => m[0]);
    const meta = name => attr(tags.find(t => attr(t, 'name') === name) || '', 'content');
    const canonical = attr(tags.find(t => attr(t, 'rel') === 'canonical') || '', 'href');
    const headings = [...body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => ({ level: Number(m[1]), text: clean(m[2]) }));
    const links = [...new Set([...body.matchAll(/<a\b[^>]*>/gi)].map(m => attr(m[0], 'href')).filter(Boolean).flatMap(href => {
      try { const u = new URL(href, origin + route); return [origin, 'https://alilu.com.br'].includes(u.origin) && !u.pathname.startsWith('/api/') ? [u.pathname] : []; } catch { return []; }
    }))];
    const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
    return { route, status: response.status, finalPath: new URL(response.url).pathname, title: clean(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || ''), description: meta('description'), canonical, robots: meta('robots'), headings, textLength: clean(main).length, links, htmlBytes: Buffer.byteLength(html), ttfbAndDownloadMs: Math.round(performance.now() - start), findings: [] };
  } catch (error) { return { route, status: 0, error: String(error), links: [], findings: ['P0: HTTP não verificado'] }; }
}
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < routes.length) { const route = routes[cursor++]; rows.push(await inspect(route)); }
}));
rows.sort((a, b) => a.route.localeCompare(b.route));
const byRoute = new Map(rows.map(r => [r.route, r]));
for (const row of rows) {
  if (!row.status || row.route.endsWith('.txt') || row.route.endsWith('.xml') || row.route === '/auditoria-rota-inexistente') continue;
  if (row.status >= 400) row.findings.push('P0: resposta HTTP de erro');
  if (!row.title) row.findings.push('P1: title ausente');
  if (!row.description) row.findings.push('P2: description ausente');
  if (!row.canonical && !row.robots?.includes('noindex')) row.findings.push('P1: canonical ausente');
  if (!row.headings?.some(h => h.level === 1)) row.findings.push('P2: H1 ausente no HTML');
  for (const link of row.links) {
    if ((byRoute.get(link)?.status || 0) >= 400) row.findings.push(`P1: link quebrado ${link}`);
  }
}
const folder = 'docs/auditoria-adsense';
await fs.mkdir(folder, { recursive: true });
await fs.writeFile(`${folder}/${label}-http.json`, JSON.stringify({ origin, checkedAt: new Date().toISOString(), templatesNotRequested: templates, rows }, null, 2));
const escape = s => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
await fs.writeFile(`${folder}/${label}-urls.md`, `# Verificação HTTP: ${label}\n\nOrigem: ${origin}. ${rows.length} URLs; visita anônima, sem executar JavaScript. HTTP 200 não comprova funcionamento interativo. Tempos são uma amostra sem controle de rede; não são Core Web Vitals. Detalhes de títulos, headings, links e tamanho em ${label}-http.json.\n\n| URL | HTTP | Indexação no HTML | Conteúdo principal (caracteres) | Achados mecânicos |\n| --- | --- | --- | --- | --- |\n` + rows.map(r => `| ${escape(r.route)} | ${r.status} | ${escape(r.robots || 'padrão')} | ${r.textLength ?? '—'} | ${escape(r.findings.join('; ') || 'Sem falha mecânica detectada')} |`).join('\n') + '\n\nRotas dinâmicas por ID/token não foram requisitadas com dados fictícios: ' + templates.map(s => '`' + s + '`').join(', ') + '.\n');
console.log(JSON.stringify({ origin, urls: rows.length, errors: rows.filter(r => r.status !== 200 && r.route !== '/auditoria-rota-inexistente'), findings: rows.filter(r => r.findings.length).map(r => ({ route: r.route, findings: r.findings })) }, null, 2));
