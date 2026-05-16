import { describe, expect, it } from 'vitest';
import { fallbackPathCandidates, findLegalLink } from './legalLinkFinder';

describe('findLegalLink', () => {
  it('finds anchor with "Mentions légales" text', () => {
    const url = findLegalLink([
      { text: 'Accueil', href: 'https://x.fr/' },
      { text: 'Mentions légales', href: 'https://x.fr/legal/' },
      { text: 'Contact', href: 'https://x.fr/contact' },
    ]);
    expect(url).toBe('https://x.fr/legal/');
  });

  it('matches case-insensitively and with hyphen variants', () => {
    expect(
      findLegalLink([{ text: 'mentions-legales', href: '/ml' }]),
    ).toBe('/ml');
    expect(
      findLegalLink([{ text: 'MENTIONS LEGALES', href: '/ml' }]),
    ).toBe('/ml');
    expect(
      findLegalLink([{ text: 'Mention légale', href: '/ml' }]),
    ).toBe('/ml');
  });

  it('falls back to href slug when text is generic', () => {
    const url = findLegalLink([
      { text: 'En savoir plus', href: 'https://x.fr/mentions-legales' },
      { text: 'Blog', href: 'https://x.fr/blog' },
    ]);
    expect(url).toBe('https://x.fr/mentions-legales');
  });

  it('matches Impressum (DE/CH sites)', () => {
    expect(findLegalLink([{ text: 'Impressum', href: '/imp' }])).toBe('/imp');
  });

  it('matches /legal slug in href', () => {
    expect(
      findLegalLink([{ text: 'Info', href: 'https://x.fr/legal' }]),
    ).toBe('https://x.fr/legal');
  });

  it('returns null when nothing matches', () => {
    expect(findLegalLink([
      { text: 'Accueil', href: '/' },
      { text: 'Blog', href: '/blog' },
    ])).toBeNull();
  });

  it('ignores anchors without href', () => {
    expect(findLegalLink([{ text: 'Mentions légales', href: '' }])).toBeNull();
  });

  it('prioritizes text match over href fallback', () => {
    const url = findLegalLink([
      { text: 'Autre lien', href: 'https://x.fr/mentions-legales-old' },
      { text: 'Mentions légales', href: 'https://x.fr/legal-v2' },
    ]);
    expect(url).toBe('https://x.fr/legal-v2');
  });
});

describe('fallbackPathCandidates', () => {
  it('returns common mentions-légales paths for a base URL', () => {
    const candidates = fallbackPathCandidates('https://example.fr/contact');
    expect(candidates).toContain('https://example.fr/mentions-legales');
    expect(candidates).toContain('https://example.fr/legal');
    expect(candidates.every((c) => c.startsWith('https://example.fr/'))).toBe(true);
  });

  it('handles subdomain', () => {
    const candidates = fallbackPathCandidates('https://www.example.fr/');
    expect(candidates).toContain('https://www.example.fr/mentions-legales');
  });

  it('returns empty array on invalid URL', () => {
    expect(fallbackPathCandidates('not-a-url')).toEqual([]);
  });
});
