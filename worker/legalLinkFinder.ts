/**
 * Heuristic discovery of the "mentions légales" page link from a list of anchors.
 * Pure function — easy to test without Playwright.
 */

export interface AnchorLike {
  text: string;
  href: string;
}

const LEGAL_TEXT_RE = /(mentions?[- ]?l[ée]gales?|legal[- ]?notice|impressum|informations?[- ]?l[ée]gales?)/i;
const LEGAL_HREF_RE = /(mentions?[- ]?l[ée]gales?|legal[- ]?notice|impressum|\/legal\b|\/legals?\b)/i;
const FOOTER_CANDIDATE_RE = /(politique[- ]?(de[- ])?confidentialit|cgv|cgu|privacy|cookies?|terms?)/i;

export function findLegalLink(anchors: AnchorLike[]): string | null {
  // Strong match: text mentions "mentions légales" or equivalent
  for (const a of anchors) {
    if (a.href && LEGAL_TEXT_RE.test(a.text || '')) return a.href;
  }
  // Fallback: href contains legal-notice slug
  for (const a of anchors) {
    if (a.href && LEGAL_HREF_RE.test(a.href)) return a.href;
  }
  return null;
}

/**
 * Sibling-page heuristic: when there is no "mentions légales" link but a
 * privacy/CGV link exists, mentions-légales is often at the same path level.
 * Returns candidate URL paths to try.
 */
export function fallbackPathCandidates(currentUrl: string): string[] {
  try {
    const url = new URL(currentUrl);
    const base = `${url.protocol}//${url.host}`;
    return [
      `${base}/mentions-legales`,
      `${base}/mentions-legales/`,
      `${base}/mentions-legales.html`,
      `${base}/legal`,
      `${base}/legal-notice`,
      `${base}/fr/mentions-legales`,
    ];
  } catch {
    return [];
  }
}

export const _internal = { FOOTER_CANDIDATE_RE };
