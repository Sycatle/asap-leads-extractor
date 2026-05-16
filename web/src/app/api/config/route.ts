/**
 * Config endpoint - simplifié post-migration Drizzle.
 * L'ancien store DB (scraper_niches/cities/settings) sera réintégré dans une
 * itération dédiée. Pour l'instant, GET retourne une config par défaut en lecture
 * seule ; PUT renvoie 503 (mutation désactivée).
 */
import { NextResponse } from 'next/server';

const DEFAULT_CONFIG = {
  target: 100,
  allowed_departments: ['72', '49', '53', '44', '85'],
  exclude_keywords: ['Carrefour', "McDonald's", 'Leclerc', 'Auchan', 'Intermarché'],
  scrape: { niches: ['coiffeur'], cities: ['Le Mans'] },
};

export async function GET() {
  return NextResponse.json({ source: 'default', ...DEFAULT_CONFIG });
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Config mutation désactivée le temps du port Drizzle de scraperConfig' },
    { status: 503 },
  );
}
