/**
 * Lead scoring and classification utilities
 */

import type { InsertLead } from './db.js';
import type { WebsiteStatus } from '../shared/types.js';

/**
 * Calculate lead score (0-100)
 * HIGH score = poorly referenced business = BETTER prospect for selling website services
 * 
 * This function evaluates multiple criteria to determine how likely a business
 * is to need web services based on their current digital presence.
 */
export function calculateLeadScore(lead: InsertLead): number {
  let score = 50; // Base score
  
  // ===== MAJOR CRITERIA (poorly referenced = good prospect) =====
  
  // No website = +25 (most important criterion!)
  if (!lead.website) {
    score += 25;
  }
  
  // Website on platform (Planity, etc.) = +15 (they need a real site)
  if (lead.website_status === 'platform') {
    score += 15;
  }
  
  // Old/obsolete website = +10
  if (lead.website_status === 'old') {
    score += 10;
  }
  
  // No image on Google Maps = +10 (poorly optimized)
  if (!lead.image_url) {
    score += 10;
  }
  
  // No online booking = +10 (digitalization potential)
  if (lead.has_booking === false) {
    score += 10;
  }
  
  // ===== SECONDARY CRITERIA =====
  
  // Few reviews = +10 (less visible business)
  if (lead.reviews_count != null && lead.reviews_count < 10) {
    score += 10;
  } else if (lead.reviews_count != null && lead.reviews_count < 30) {
    score += 5;
  }
  
  // Average or low rating = +5 (can improve their image)
  if (lead.rating != null && lead.rating < 4) {
    score += 5;
  }
  
  // ===== PENALTIES (well-referenced business = less priority) =====
  
  // Modern website = -15
  if (lead.website_status === 'modern') {
    score -= 15;
  }
  
  // Many reviews + good rating = -10 (already well-referenced)
  if (lead.rating != null && lead.rating >= 4.5 && 
      lead.reviews_count != null && lead.reviews_count > 100) {
    score -= 10;
  }
  
  // Online booking = -5 (already digitalized)
  if (lead.has_booking === true) {
    score -= 5;
  }
  
  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Classify website status based on URL
 * Returns the type of website (none, platform, modern, old)
 */
export function classifyWebsiteStatus(url: string | null | undefined): WebsiteStatus {
  if (!url) {
    return 'none';
  }
  
  const lowerUrl = url.toLowerCase();
  
  // Booking platforms = not a real website (GOOD PROSPECT)
  const bookingPlatforms = [
    'planity.com', 'doctolib.', 'reservationcoiffeur.', 'treatwell.', 
    'kiute.', 'balinea.', 'moncoiffeur.fr', 'flexy-hair.',
    'upmysalon.', 'wavy.pro', 'salonkee.', 'timify.'
  ];
  
  // Social networks = not a real website (GOOD PROSPECT)
  const socialPlatforms = [
    'instagram.com', 'facebook.com', 'fb.com', 'twitter.com', 
    'tiktok.com', 'linkedin.com', 'youtube.com'
  ];
  
  // Yellow pages and directories = not a real website (GOOD PROSPECT)
  const directoryPlatforms = [
    'pagesjaunes.fr', 'yelp.', 'tripadvisor.', 'google.com/maps',
    'justacote.com', 'mappy.com', 'infobel.'
  ];
  
  if ([...bookingPlatforms, ...socialPlatforms, ...directoryPlatforms]
      .some(platform => lowerUrl.includes(platform))) {
    return 'platform';
  }
  
  // Own website - default to modern (could be improved with further analysis)
  // TODO: Add actual website age/quality analysis
  return 'modern';
}

/**
 * Calculate priority level based on score
 */
export function calculatePriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Compute best call time based on opening hours
 * Suggests optimal time to call based on business hours
 */
export function computeBestCallTime(openingHours: string | undefined): string | undefined {
  if (!openingHours) return undefined;
  
  // Look for typical opening hours
  // Expected format: "Monday 9:00-12:00, 14:00-18:00"
  const timePattern = /(\d{1,2}):(\d{2})/g;
  const times: number[] = [];
  
  let match;
  while ((match = timePattern.exec(openingHours)) !== null) {
    times.push(parseInt(match[1], 10));
  }
  
  if (times.length === 0) return undefined;
  
  // Find most common opening hour
  const validTimes = times.filter(h => h >= 7 && h <= 12);
  if (validTimes.length === 0) return undefined;
  
  const openHour = Math.min(...validTimes);
  
  if (openHour && openHour < 12) {
    // Suggest 30 min after opening (time for them to settle in)
    const suggestedHour = openHour + 1;
    return `${suggestedHour}h-${suggestedHour + 1}h`;
  }
  
  // Default: mid-morning
  return '10h-11h';
}
