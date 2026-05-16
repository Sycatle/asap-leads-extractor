/**
 * Reply classifier — analyse une réponse inbound via Claude Haiku.
 *
 * Sortie structurée (zod) :
 *   intent : positive | negative | neutral | ooo | wrong_person | unsub_request | question
 *   confidence : 0-1
 *   ooo_until : ISO date string (si OOO et date extraite)
 *   summary : 1 phrase
 *
 * Coût tracké via `llmUsage` (feature = 'reply_classifier').
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { recordUsage } from '../../db/queries/llmUsage';
import { logger as log } from '../logger';
import 'dotenv/config';

const MODEL = process.env.REPLY_CLASSIFIER_MODEL || 'claude-haiku-4-5';

export const ClassificationSchema = z.object({
  intent: z.enum([
    'positive',
    'negative',
    'neutral',
    'ooo',
    'wrong_person',
    'unsub_request',
    'question',
  ]).describe('Intention principale détectée dans la réponse'),
  confidence: z.number().min(0).max(1).describe('Confiance 0..1 du classifieur'),
  ooo_until: z.string().nullable().describe('Date ISO de fin d\'absence si OOO (sinon null)'),
  suggested_action: z.string().describe('Action humaine recommandée en 1 phrase'),
  summary: z.string().describe('Résumé de la réponse en 1 phrase factuelle'),
});

export type Classification = z.infer<typeof ClassificationSchema>;

export interface ClassifyOptions {
  client?: Anthropic;
  leadId?: number | null;
}

const SYSTEM_PROMPT = `Tu classes des réponses d'emails outbound B2B (prospects qui répondent à un email commercial).

Catégories :
- positive : le prospect manifeste un intérêt (RDV, info produit, prix, "discutons", merci de votre message intéressant)
- negative : refus clair ("pas intéressé", "pas pour nous", "stop")
- neutral : réponse non-engageante sans signal fort (accusé de réception, "noté", "je vous reviens")
- ooo : auto-reply absence/congés. Extraire la date de retour si présente (format ISO 8601)
- wrong_person : le destinataire n'est pas le bon contact ("voyez plutôt M. X", "je ne m'occupe pas de ça")
- unsub_request : demande explicite de désinscription ("unsubscribe", "désinscrivez-moi", "ne plus me contacter", "retirez mon email")
- question : le prospect pose une question concrète qui nécessite une réponse humaine

Réponds toujours via la structure JSON demandée. summary doit être en français, factuel, max 25 mots.`;

export async function classifyReply(
  subject: string,
  bodyText: string,
  opts: ClassifyOptions = {},
): Promise<Classification> {
  const client = opts.client ?? new Anthropic();
  const safeBody = bodyText.slice(0, 8000); // hard cap pour OOO bavards

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 512,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Sujet: ${subject || '(vide)'}\n\nCorps:\n${safeBody}`,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { format: zodOutputFormat(ClassificationSchema as any) },
    });
  } catch (err) {
    await recordUsage(getDb(), {
      model: MODEL,
      feature: 'reply_classifier',
      lead_id: opts.leadId ?? null,
      input_tokens: 0,
      output_tokens: 0,
      success: false,
      error_message: err instanceof Error ? err.message : String(err),
    });
    log.error(`[classifier] failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }

  await recordUsage(getDb(), {
    model: MODEL,
    feature: 'reply_classifier',
    lead_id: opts.leadId ?? null,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
  });

  if (!response.parsed_output) {
    throw new Error('classifier returned no parsed output');
  }
  return response.parsed_output;
}
