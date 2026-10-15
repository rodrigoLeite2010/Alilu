import fs from 'node:fs/promises';

const base = process.argv[2] || 'http://localhost:3100';
const output = 'docs/auditoria-adsense';
const data = JSON.parse(await fs.readFile(`${output}/local-http.json`, 'utf8'));
const rows = new Map(data.rows.map(row => [row.route, row]));
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const robots = await (await fetch(`${base}/robots.txt`)).text();
const ads = await (await fetch(`${base}/ads.txt`)).text();
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
const problems = [];
for (const url of urls) {
  const row = rows.get(new URL(url).pathname);
  if (!row || row.status !== 200) problems.push(`URL de sitemap sem HTTP 200: ${url}`);
  if (row?.robots.includes('noindex')) problems.push(`noindex no sitemap: ${url}`);
  if (row?.canonical !== url) problems.push(`Canonical divergente: ${url} -> ${row?.canonical}`);
}
if (new Set(urls).size !== urls.length) problems.push('URLs repetidas no sitemap');
if (!robots.includes('Allow: /') || robots.includes('Disallow: /\n')) problems.push('Bloqueio geral em robots');
if (!robots.includes('Sitemap: https://alilu.com.br/sitemap.xml')) problems.push('Sitemap incorreto em robots');
const publisherMatch = ads.trim() === 'google.com, pub-2601584178688625, DIRECT, f08c47fec0942fa0';
if (!publisherMatch) problems.push('ads.txt divergente do publisher existente');
const linked = new Set(data.rows.flatMap(row => row.links.filter(link => link !== row.route)));
const orphans = urls.filter(url => !linked.has(new URL(url).pathname));
const redirects = [];
for (const url of ['http://alilu.com.br', 'https://www.alilu.com.br', `${base}/utilitarios/financeiro/sac-x-price`, `${base}/utilitarios/financeiro/financiamento-veiculo/`]) {
  try { const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) }); redirects.push({ url, status: response.status, location: response.headers.get('location') }); }
  catch (error) { redirects.push({ url, error: String(error) }); }
}
const result = { checkedAt: new Date().toISOString(), sitemapEntries: urls.length, problems, orphansInObservedLinks: orphans, publisherMatch, financingIndexable: urls.includes('https://alilu.com.br/utilitarios/financeiro/financiamento-veiculo') && !rows.get('/utilitarios/financeiro/financiamento-veiculo').robots.includes('noindex'), redirects, robots };
await fs.writeFile(`${output}/seo-validation.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (problems.length) process.exitCode = 1;
