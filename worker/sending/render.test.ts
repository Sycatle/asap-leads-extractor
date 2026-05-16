import { describe, expect, it } from 'vitest';
import { extractVariables, renderTemplate } from './render';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'Jean' })).toBe('Hello Jean');
  });

  it('handles spaces inside braces', () => {
    expect(renderTemplate('{{  name  }}', { name: 'Jean' })).toBe('Jean');
  });

  it('replaces missing var with empty string', () => {
    expect(renderTemplate('Hi {{firstName}} {{lastName}}', { firstName: 'A' })).toBe('Hi A ');
  });

  it('handles multiple occurrences', () => {
    expect(renderTemplate('{{x}}/{{x}}', { x: 'a' })).toBe('a/a');
  });

  it('does NOT evaluate code (no Handlebars semantics)', () => {
    // Pas de helpers, pas de #if, pas de évaluation : tout est littéral
    expect(renderTemplate('{{#if x}}yes{{/if}}', { x: 1 })).toBe('{{#if x}}yes{{/if}}');
  });

  it('coerces numbers to strings', () => {
    expect(renderTemplate('{{n}}', { n: 42 })).toBe('42');
  });
});

describe('extractVariables', () => {
  it('returns unique sorted variable names', () => {
    expect(extractVariables('Hi {{firstName}} {{lastName}} {{firstName}}')).toEqual(['firstName', 'lastName']);
  });

  it('handles dotted paths', () => {
    expect(extractVariables('{{lead.name}}')).toEqual(['lead.name']);
  });

  it('returns empty array if no variables', () => {
    expect(extractVariables('Plain text')).toEqual([]);
  });
});
