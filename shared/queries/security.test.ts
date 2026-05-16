import { describe, expect, it } from 'vitest';
import { sanitizeOrderBy, sanitizeOrderDir, softDeleteFilter, combineConditions } from './security';

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

describe('softDeleteFilter', () => {
  it('excludes deleted by default', () => {
    expect(softDeleteFilter()).toBe('deleted_at IS NULL');
  });

  it('returns empty string when includeDeleted=true', () => {
    expect(softDeleteFilter(true)).toBe('');
  });
});

describe('combineConditions', () => {
  it('returns empty string when no conditions', () => {
    expect(combineConditions([])).toBe('');
    expect(combineConditions(['', '  '])).toBe('');
  });

  it('joins conditions with AND prefixed by WHERE', () => {
    expect(combineConditions(['a = 1', 'b = 2'])).toBe('WHERE a = 1 AND b = 2');
  });

  it('filters out empty entries before joining', () => {
    expect(combineConditions(['a = 1', '', 'c = 3'])).toBe('WHERE a = 1 AND c = 3');
  });
});
