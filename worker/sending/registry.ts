/**
 * Registry — résout un provider depuis un sender_account.
 *
 * On instancie un provider par config unique (mémoïsation sur apiKey).
 */

import type { SenderAccount } from '../../db/schema';
import { ResendProvider } from './resendProvider';
import type { ISendingProvider } from './types';

const resendCache = new Map<string, ResendProvider>();

interface ResendProviderConfig {
  resendApiKey?: string;
  webhookSecret?: string;
}

export function getProvider(sender: SenderAccount): ISendingProvider {
  switch (sender.provider) {
    case 'resend': {
      const cfg = (sender.providerConfig ?? {}) as ResendProviderConfig;
      const apiKey = cfg.resendApiKey ?? process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error(`sender ${sender.id} has no Resend API key (env RESEND_API_KEY or providerConfig.resendApiKey)`);
      }
      const cached = resendCache.get(apiKey);
      if (cached) return cached;
      const provider = new ResendProvider({
        apiKey,
        webhookSecret: cfg.webhookSecret ?? process.env.RESEND_WEBHOOK_SECRET,
      });
      resendCache.set(apiKey, provider);
      return provider;
    }
    case 'smtp':
      throw new Error('SMTP provider not implemented yet');
    default:
      throw new Error(`unknown sender provider: ${sender.provider}`);
  }
}

/** Provider "anonyme" pour ingest webhook quand on n'a pas de sender associé */
export function getResendWebhookProvider(): ResendProvider {
  const apiKey = process.env.RESEND_API_KEY ?? 'webhook-only';
  const cached = resendCache.get(apiKey);
  if (cached) return cached;
  const provider = new ResendProvider({
    apiKey,
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  });
  resendCache.set(apiKey, provider);
  return provider;
}
