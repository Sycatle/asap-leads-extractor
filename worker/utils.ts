/**
 * Shared utility functions for the worker
 */

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize French phone number to standard format (0612345678)
 * Handles +33, 0033, and 0X formats
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s.\-()]/g, '');
  
  // Format FR: commence par 0 ou +33
  if (cleaned.startsWith('+33')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('33') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  
  return ''; // Invalide
}

/**
 * Extract postal code from address string
 */
export function extractPostalCode(input: string): string {
  const match = input.match(/\b(\d{5})\b/);
  return match ? match[1] : '';
}

/**
 * Extract city name from address string
 * Handles apostrophes and special characters
 */
export function extractCity(address: string): string {
  const match = address.match(/\d{5}\s+([A-Za-zÀ-ÿ\s\-'']+)/);
  if (match) {
    return normalizeCity(match[1].trim().replace(/\s+/g, ' '));
  }
  return '';
}

/**
 * Normalize city name
 * - Removes leading dashes/spaces
 * - Capitalizes properly
 * - Maps Paris arrondissements to "Paris"
 */
export function normalizeCity(city: string): string {
  if (!city) return '';
  
  // Nettoyer les tirets et espaces en début/fin
  const normalized = city.trim().replace(/^[-–—\s]+/, '').replace(/[-–—\s]+$/, '');
  
  // Paris et arrondissements → "Paris"
  if (/^paris/i.test(normalized) || /paris\s*\d+/i.test(normalized) || /^\d+e?\s*arr/i.test(normalized)) {
    return 'Paris';
  }
  
  // Lyon arrondissements → "Lyon"
  if (/^lyon/i.test(normalized) || /lyon\s*\d+/i.test(normalized)) {
    return 'Lyon';
  }
  
  // Marseille arrondissements → "Marseille"
  if (/^marseille/i.test(normalized) || /marseille\s*\d+/i.test(normalized)) {
    return 'Marseille';
  }
  
  // Capitalisation correcte: première lettre majuscule après espace/tiret
  return normalized
    .toLowerCase()
    .replace(/(?:^|\s|-)([a-zà-ÿ])/g, (m) => m.toUpperCase());
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
