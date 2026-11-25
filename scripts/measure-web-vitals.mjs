// Mobile Core Web Vitals (FCP, LCP, CLS, page weight) of a running Tamurt Jobs build, with a Pixel 7
// profile, 4x CPU slowdown and a slow 4G network. Usage: node scripts/measure-web-vitals.mjs fr fr/jobs
// (BASE_URL defaults to http://localhost:3000).
import { chromium, devices } from "@playwright/test";
(async () => {
  const browser = await chromium.launch();
  for (const path of process.argv.slice(2)) {
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    let bytes = 0;
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; });
    await page.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const t0 = Date.now();
    await page.goto((process.env.BASE_URL ?? 'http://localhost:3000') + '/' + path, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0 }));
    console.log(`${path.padEnd(58)} FCP ${(m.fcp / 1000).toFixed(2)} s | LCP ${(m.lcp / 1000).toFixed(2)} s | CLS ${m.cls.toFixed(3)} | transferred ${(bytes / 1024).toFixed(0)} KiB | load ${(Date.now() - t0) / 1000} s`);
    await context.close();
  }
  await browser.close();
})();
