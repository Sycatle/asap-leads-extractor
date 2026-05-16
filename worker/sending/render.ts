/**
 * Rendu de templates : variables `{{name}}` remplacées par valeurs du contexte.
 *
 * Volontairement minimal : pas de Handlebars/Liquid pour éviter le risque
 * d'évaluation de code arbitraire dans un template stocké en DB.
 *
 * Variables non résolues → chaîne vide (et log).
 */

import { logger as log } from '../logger';

export type RenderContext = Record<string, string | number | null | undefined>;

const VARIABLE_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

export function renderTemplate(input: string, ctx: RenderContext): string {
  return input.replace(VARIABLE_RE, (_match, key: string) => {
    const value = ctx[key];
    if (value === undefined || value === null || value === '') {
      log.info(`[render] variable manquante: {{${key}}}`);
      return '';
    }
    return String(value);
  });
}

/** Variables détectées dans le template (pour validation UI). */
export function extractVariables(input: string): string[] {
  const found = new Set<string>();
  for (const match of input.matchAll(VARIABLE_RE)) {
    found.add(match[1]);
  }
  return Array.from(found).sort();
}
