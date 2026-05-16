import { describe, expect, it } from 'vitest';
import { sanitizeOrderBy, sanitizeOrderDir } from './filters';

describe('sanitizeOrderBy', () => {
  it('returns whitelisted column unchanged', () => {
    expect(sanitizeOrderBy('score')).toBe('score');
    expect(sanitizeOrderBy('created_at')).toBe('created_at');
  });

  it('falls back to default for unknown column', () => {
    expect(sanitizeOrderBy('password')).toBe('created_at');
    expect(sanitizeOrderBy('; DROP TABLE leads--')).toBe('created_at');
  });

  it('uses provided default when column missing', () => {
    expect(sanitizeOrderBy(undefined, 'name')).toBe('name');
  });
});

describe('sanitizeOrderDir', () => {
  it.each([
    ['asc', 'ASC'],
    ['ASC', 'ASC'],
    ['desc', 'DESC'],
    ['DESC', 'DESC'],
    [undefined, 'DESC'],
    ['bogus', 'DESC'],
  ])('maps %s -> %s', (input, expected) => {
    expect(sanitizeOrderDir(input as string | undefined)).toBe(expected);
  });
});
