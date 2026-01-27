/**
 * SQL Security Utilities
 * Protection contre les injections SQL pour les queries dynamiques
 */

// ===== ORDER BY SECURITY =====

/**
 * Colonnes autorisées pour ORDER BY (prévention injection SQL)
 * IMPORTANT: Ne jamais interpoler directement des valeurs utilisateur dans ORDER BY
 */
export const VALID_ORDER_COLUMNS = [
  'created_at',
  'updated_at',
  'score',
  'rating',
  'name',
  'city',
  'next_followup_at',
  'priority',
  'status',
  'call_status',
  'niche',
  'reviews_count',
] as const;

export type ValidOrderColumn = typeof VALID_ORDER_COLUMNS[number];

/**
 * Valide et retourne une colonne ORDER BY sécurisée
 */
export function sanitizeOrderBy(column: string | undefined, defaultColumn: ValidOrderColumn = 'created_at'): ValidOrderColumn {
  if (!column) return defaultColumn;
  return VALID_ORDER_COLUMNS.includes(column as ValidOrderColumn) 
    ? (column as ValidOrderColumn) 
    : defaultColumn;
}

/**
 * Valide et retourne une direction ORDER BY sécurisée
 */
export function sanitizeOrderDir(dir: string | undefined): 'ASC' | 'DESC' {
  return dir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

// ===== SOFT DELETE =====

/**
 * Clause WHERE pour exclure les leads supprimés (soft-delete)
 * @param includeDeleted Si true, ne filtre pas les supprimés
 */
export function softDeleteFilter(includeDeleted = false): string {
  return includeDeleted ? '' : 'deleted_at IS NULL';
}

/**
 * Combine plusieurs conditions WHERE avec AND
 */
export function combineConditions(conditions: string[]): string {
  const filtered = conditions.filter(c => c.trim() !== '');
  return filtered.length > 0 ? 'WHERE ' + filtered.join(' AND ') : '';
}
