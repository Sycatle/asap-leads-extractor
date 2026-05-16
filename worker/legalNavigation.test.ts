/**
 * E2E navigation test : sert un mini-site Node http, lance Playwright,
 * vérifie que findLegalLink + Playwright trouvent bien la page mentions-légales
 * et que son contenu est extrayable.
 */

import { createServer, type Server } from 'http';
import { type AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { fallbackPathCandidates, findLegalLink } from './legalLinkFinder';

const HOMEPAGE_HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Plomberie Dupont</title></head>
<body>
  <header><h1>Plomberie Dupont</h1></header>
  <main><p>Dépannage 24/7 à Paris.</p></main>
  <footer>
    <nav>
      <a href="/contact">Contact</a>
      <a href="/cgv">CGV</a>
      <a href="/mentions-legales">Mentions légales</a>
    </nav>
  </footer>
</body></html>`;

const LEGAL_HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Mentions légales</title></head>
<body>
  <h1>Mentions légales</h1>
  <p>Raison sociale : SARL Plomberie Dupont</p>
  <p>SIREN : 123456789 — SIRET : 12345678900012</p>
  <p>RCS Paris B 123 456 789</p>
  <p>Capital social : 10 000 €</p>
  <p>Dirigeant : Jean Dupont</p>
  <p>Contact : contact@plomberie-dupont.fr</p>
  <p>Hébergeur : OVH SAS, 2 rue Kellermann, 59100 Roubaix</p>
</body></html>`;

let server: Server;
let baseUrl: string;
let browser: Browser;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HOMEPAGE_HTML);
    } else if (url === '/mentions-legales' || url === '/mentions-legales/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LEGAL_HTML);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('legal navigation (E2E)', () => {
  it('finds the mentions-légales link from the homepage DOM', async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const anchors = await page.evaluate(() => {
      const out: { text: string; href: string }[] = [];
      document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        out.push({ text: (a.textContent || '').trim(), href: a.href });
      });
      return out;
    });

    const legalUrl = findLegalLink(anchors);
    expect(legalUrl).toContain('/mentions-legales');

    await page.close();
  });

  it('navigates to the legal page and extracts the expected text', async () => {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/mentions-legales`, { waitUntil: 'domcontentloaded' });

    const text = await page.evaluate(() => document.body?.innerText || '');
    expect(text).toContain('SIREN : 123456789');
    expect(text).toContain('RCS Paris');
    expect(text).toContain('Capital social');
    expect(text).toContain('OVH SAS');
    expect(text).toContain('contact@plomberie-dupont.fr');

    await page.close();
  });

  it('fallback path candidates resolve to the actual legal URL', async () => {
    const candidates = fallbackPathCandidates(`${baseUrl}/`);
    const expected = `${baseUrl}/mentions-legales`;
    expect(candidates).toContain(expected);

    // First candidate that returns 200 is /mentions-legales
    const page = await browser.newPage();
    let foundOk = false;
    for (const candidate of candidates) {
      const resp = await page.goto(candidate, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (resp && resp.ok()) {
        foundOk = true;
        expect(page.url()).toBe(expected);
        break;
      }
    }
    expect(foundOk).toBe(true);
    await page.close();
  });
});
