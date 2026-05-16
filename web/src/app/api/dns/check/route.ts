/**
 * DNS check pour SPF/DKIM/DMARC d'un domaine.
 *
 * Vérifications :
 *  - SPF : TXT root contenant "v=spf1"
 *  - DMARC : TXT _dmarc.{domain} contenant "v=DMARC1"
 *  - DKIM : TXT {selector}._domainkey.{domain} contenant "v=DKIM1"
 *
 * Le selector DKIM dépend du provider. Pour Resend : "resend".
 */

import { resolveTxt } from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  domain: z.string().min(3).max(253).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'invalid domain'),
  dkimSelector: z.string().regex(/^[a-z0-9_-]+$/i).default('resend'),
});

interface CheckResult {
  domain: string;
  spf: { ok: boolean; record?: string; error?: string };
  dmarc: { ok: boolean; record?: string; policy?: string; error?: string };
  dkim: { ok: boolean; selector: string; record?: string; error?: string };
}

async function txt(host: string): Promise<string | null> {
  try {
    const records = await resolveTxt(host);
    if (records.length === 0) return null;
    return records.map((r) => r.join('')).join('\n');
  } catch {
    return null;
  }
}

async function check(domain: string, dkimSelector: string): Promise<CheckResult> {
  const result: CheckResult = {
    domain,
    spf: { ok: false },
    dmarc: { ok: false },
    dkim: { ok: false, selector: dkimSelector },
  };

  const spfRecord = await txt(domain);
  if (spfRecord && /v=spf1/i.test(spfRecord)) {
    result.spf = { ok: true, record: spfRecord };
  } else {
    result.spf.error = 'no SPF TXT (v=spf1) record on root domain';
  }

  const dmarcRecord = await txt(`_dmarc.${domain}`);
  if (dmarcRecord && /v=DMARC1/i.test(dmarcRecord)) {
    const policy = dmarcRecord.match(/p=([a-z]+)/i)?.[1];
    result.dmarc = { ok: true, record: dmarcRecord, policy };
  } else {
    result.dmarc.error = 'no DMARC TXT (v=DMARC1) at _dmarc subdomain';
  }

  const dkimRecord = await txt(`${dkimSelector}._domainkey.${domain}`);
  if (dkimRecord && /v=DKIM1/i.test(dkimRecord)) {
    result.dkim = { ok: true, selector: dkimSelector, record: dkimRecord };
  } else {
    result.dkim.error = `no DKIM TXT at ${dkimSelector}._domainkey.${domain}`;
  }

  return result;
}

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    domain: request.nextUrl.searchParams.get('domain'),
    dkimSelector: request.nextUrl.searchParams.get('dkimSelector') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.issues },
      { status: 400 },
    );
  }
  const result = await check(parsed.data.domain, parsed.data.dkimSelector);
  return NextResponse.json(result);
}
