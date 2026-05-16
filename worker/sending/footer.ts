/**
 * Footer RGPD obligatoire — injecté dans chaque email outbound.
 *
 * Conforme CNIL (art. L.34-5 CPCE) :
 *  - identité de l'expéditeur
 *  - source des coordonnées (data_source du lead)
 *  - lien désabo one-click (RFC 8058)
 *  - lien politique de confidentialité
 *
 * Le sender et l'enrollment donnent tout le contexte nécessaire.
 */

export interface FooterContext {
  senderName: string;
  senderCompany: string;
  senderAddress?: string;
  /** Source des coordonnées du destinataire (ex: "Google Maps public listing") */
  dataSource: string;
  privacyUrl: string;
  unsubUrl: string;
}

export function buildFooterText(ctx: FooterContext): string {
  const lines = [
    '',
    '—',
    `${ctx.senderName}, ${ctx.senderCompany}${ctx.senderAddress ? ' — ' + ctx.senderAddress : ''}`,
    `Vous recevez cet email car votre activité professionnelle correspond à notre offre.`,
    `Source de vos coordonnées : ${ctx.dataSource}`,
    `Politique de confidentialité : ${ctx.privacyUrl}`,
    `Se désinscrire en un clic : ${ctx.unsubUrl}`,
  ];
  return lines.join('\n');
}

export function buildFooterHtml(ctx: FooterContext): string {
  return `
<hr style="border:none;border-top:1px solid #ccc;margin:24px 0 12px"/>
<div style="font-size:11px;color:#666;line-height:1.4">
  <div>${escape(ctx.senderName)}, ${escape(ctx.senderCompany)}${ctx.senderAddress ? ' — ' + escape(ctx.senderAddress) : ''}</div>
  <div>Vous recevez cet email car votre activité professionnelle correspond à notre offre.</div>
  <div>Source de vos coordonnées : ${escape(ctx.dataSource)}</div>
  <div>
    <a href="${escape(ctx.privacyUrl)}" style="color:#666">Politique de confidentialité</a>
    &nbsp;·&nbsp;
    <a href="${escape(ctx.unsubUrl)}" style="color:#666">Se désinscrire en un clic</a>
  </div>
</div>`.trim();
}

export function appendFooter(
  body: { html: string; text: string },
  ctx: FooterContext,
): { html: string; text: string } {
  return {
    html: `${body.html}\n${buildFooterHtml(ctx)}`,
    text: `${body.text}${buildFooterText(ctx)}`,
  };
}

/**
 * Headers RFC 8058 (List-Unsubscribe) — exigés par Gmail/Yahoo depuis 2024.
 */
export function buildUnsubHeaders(unsubUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
