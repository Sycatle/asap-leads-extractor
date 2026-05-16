import { describe, expect, it } from 'vitest';
import { appendFooter, buildFooterHtml, buildFooterText, buildUnsubHeaders } from './footer';

const ctx = {
  senderName: 'Alice',
  senderCompany: 'Acme SAS',
  senderAddress: '1 rue X, 75001 Paris',
  dataSource: 'Google Maps public listing',
  privacyUrl: 'https://app.test/privacy',
  unsubUrl: 'https://app.test/u/abc',
};

describe('buildFooterText', () => {
  it('contains all required CNIL mentions', () => {
    const txt = buildFooterText(ctx);
    expect(txt).toContain('Alice');
    expect(txt).toContain('Acme SAS');
    expect(txt).toContain('Source de vos coordonnées');
    expect(txt).toContain('Google Maps public listing');
    expect(txt).toContain('https://app.test/privacy');
    expect(txt).toContain('Se désinscrire en un clic');
    expect(txt).toContain('https://app.test/u/abc');
  });
});

describe('buildFooterHtml', () => {
  it('escapes user-controlled fields', () => {
    const html = buildFooterHtml({
      ...ctx,
      senderCompany: '<script>alert(1)</script>',
      dataSource: 'a"b\'c&d',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
    expect(html).toContain('&#39;');
    expect(html).toContain('&amp;');
  });

  it('includes both privacy and unsub anchors', () => {
    const html = buildFooterHtml(ctx);
    expect(html).toContain('href="https://app.test/privacy"');
    expect(html).toContain('href="https://app.test/u/abc"');
  });
});

describe('appendFooter', () => {
  it('appends to both html and text without losing original body', () => {
    const { html, text } = appendFooter(
      { html: '<p>Hello</p>', text: 'Hello' },
      ctx,
    );
    expect(html.startsWith('<p>Hello</p>')).toBe(true);
    expect(text.startsWith('Hello')).toBe(true);
    expect(html).toContain('Se désinscrire');
    expect(text).toContain('Se désinscrire');
  });
});

describe('buildUnsubHeaders', () => {
  it('returns RFC 8058 compliant headers', () => {
    const h = buildUnsubHeaders('https://app.test/u/xyz');
    expect(h['List-Unsubscribe']).toBe('<https://app.test/u/xyz>');
    expect(h['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });
});
