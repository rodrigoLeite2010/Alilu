// Requires Playwright via ALILU_PLAYWRIGHT_PATH or a local installation.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS audit CLI, with an optional external runtime. */
const { chromium } = require(process.env.ALILU_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');

(async () => {
  const origin = process.argv[2] || 'http://localhost:3100';
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const folder = 'docs/auditoria-adsense';
  await fs.mkdir(folder, { recursive: true });
  const results = [];
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.setDefaultNavigationTimeout(45000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.auditMetrics = { lcp: 0, cls: 0, longestInteractionMs: 0 };
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.auditMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.auditMetrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        if (PerformanceObserver.supportedEntryTypes.includes('event')) {
          new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.interactionId) window.auditMetrics.longestInteractionMs = Math.max(window.auditMetrics.longestInteractionMs, entry.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
        }
      });
      for (const route of ['/', '/utilitarios/financeiro/financiamento-veiculo', '/utilitarios/pdf/unir-pdf', '/utilitarios/funcoes-string/contador-caracteres', '/loterias/lotofacil', '/videos', '/privacidade']) {
        const response = await page.goto(origin + route, { waitUntil: 'load' });
        await page.waitForFunction(() => document.readyState === 'complete');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        const landingMetrics = await page.evaluate(() => ({ ...window.auditMetrics }));
        assert.equal(response.status(), 200, route);
        const visibleH1 = await page.locator('h1:visible').allTextContents();
        assert(visibleH1.length > 0, `H1 visível: ${route}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `Overflow horizontal: ${route}`);
        if (route.endsWith('/financiamento-veiculo')) {
          await page.getByLabel('Preço do veículo', { exact: true }).fill('6000000');
          await page.getByLabel('Entrada', { exact: true }).fill('1000000');
          await page.getByLabel('Taxa de juros', { exact: true }).fill('1');
          await page.getByLabel('Número de parcelas', { exact: true }).fill('24');
          await page.getByRole('button', { name: 'Simular', exact: true }).click();
          await page.getByText('Valor da parcela', { exact: true }).waitFor();
          assert((await page.locator('main').innerText()).includes('2.353,67'), 'Price: 50 mil a 1% por 24 meses');
        }
        if (route.endsWith('/contador-caracteres')) {
          await page.getByLabel('Digite ou cole o texto').fill('Olá mundo');
          assert.equal(await page.getByText('Palavras', { exact: true }).locator('..').locator('p').first().innerText(), '2');
        }
        if (route.endsWith('/unir-pdf')) {
          const doc = await PDFDocument.create(); doc.addPage(); const buffer = Buffer.from(await doc.save());
          await page.locator('input[type=file]').setInputFiles([{ name: 'primeiro.pdf', mimeType: 'application/pdf', buffer }, { name: 'segundo.pdf', mimeType: 'application/pdf', buffer }]);
          await page.getByRole('button', { name: /Unir PDFs/i }).click();
          const downloadButton = page.getByRole('button', { name: /Baixar PDF/i });
          await downloadButton.waitFor();
          const downloadPromise = page.waitForEvent('download');
          await downloadButton.click();
          const download = await downloadPromise;
          const merged = await PDFDocument.load(await fs.readFile(await download.path()));
          assert.equal(merged.getPageCount(), 2);
        }
        if (route === '/loterias/lotofacil') {
          await page.getByRole('button', { name: 'Gerar combinação', exact: true }).click();
          await page.getByRole('button', { name: /Copiar/ }).first().waitFor();
        }
        if (route === '/' || route.endsWith('/financiamento-veiculo')) await page.screenshot({ path: `${folder}/${viewport.width}-${route === '/' ? 'home' : 'financiamento'}.png`, fullPage: true });
        results.push({ viewport, route, visibleH1, overflow, landingMetrics, metrics: await page.evaluate(() => ({ ...window.auditMetrics, scripts: performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script').map(r => ({ url: r.name.replace(location.origin, ''), transferBytes: r.transferSize, decodedBytes: r.decodedBodySize })) })), errors: [...errors] });
        console.log(`OK ${viewport.width} ${route}`);
      }
      await context.close();
    }
    await fs.writeFile(`${folder}/browser.json`, JSON.stringify({ origin, checkedAt: new Date().toISOString(), note: 'Amostra de laboratório sem throttling. landingMetrics antes de interações; metrics inclui ações de teste. Duração de interação amostrada não substitui INP/CWV de campo.', results }, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
