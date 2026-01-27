import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { getDb, scraperConfig } from '@/lib/db';

const CONFIG_PATH = path.join(process.cwd(), '..', 'config.json');

interface Config {
  input_csv: string;
  target: number;
  allowed_departments: string[];
  exclude_keywords: string[];
  scrape?: {
    niches: string[];
    cities: string[];
  };
  settings?: Record<string, string>;
}

function getDefaultConfig(): Config {
  return {
    input_csv: 'data/raw/export.csv',
    target: 100,
    allowed_departments: ['72', '49', '53', '44', '85'],
    exclude_keywords: ['Carrefour', "McDonald's", 'Leclerc', 'Auchan', 'Intermarché'],
    scrape: {
      niches: ['coiffeur'],
      cities: ['Le Mans'],
    },
  };
}

/**
 * GET: Load config from database (if available) or JSON file
 */
export async function GET() {
  try {
    const db = getDb();
    
    // Try loading from database first
    if (scraperConfig.hasScraperConfigTables(db)) {
      const niches = scraperConfig.getNicheNames(db);
      const cities = scraperConfig.getCityNames(db);
      
      if (niches.length > 0 || cities.length > 0) {
        const settings = scraperConfig.getAllSettings(db);
        
        return NextResponse.json({
          source: 'database',
          scrape: {
            niches,
            cities,
          },
          allowed_departments: scraperConfig.getDepartments(db),
          exclude_keywords: scraperConfig.getExcludeKeywords(db),
          target: settings.target ? parseInt(settings.target, 10) : 100,
          settings,
          // Include detailed data with IDs for editing
          niches_detail: scraperConfig.getNiches(db, false),
          cities_detail: scraperConfig.getCities(db, false),
        });
      }
    }
    
    // Fallback to JSON file
    if (!existsSync(CONFIG_PATH)) {
      return NextResponse.json({ source: 'default', ...getDefaultConfig() });
    }
    
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);
    return NextResponse.json({ source: 'file', ...config });
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json({ source: 'error', ...getDefaultConfig() });
  }
}

/**
 * PUT: Update configuration in database
 * 
 * Supported actions:
 * - { action: 'addNiche', name: string }
 * - { action: 'updateNiche', id: number, enabled?: boolean, priority?: number }
 * - { action: 'deleteNiche', id: number }
 * - { action: 'addCity', name: string, department?: string }
 * - { action: 'updateCity', id: number, enabled?: boolean, priority?: number }
 * - { action: 'deleteCity', id: number }
 * - { action: 'addDepartment', code: string, name?: string }
 * - { action: 'toggleDepartment', code: string, enabled: boolean }
 * - { action: 'addExcludeKeyword', keyword: string }
 * - { action: 'removeExcludeKeyword', keyword: string }
 * - { action: 'setSetting', key: string, value: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    
    if (!scraperConfig.hasScraperConfigTables(db)) {
      return NextResponse.json(
        { error: 'Database config tables not found. Run migrations first.' },
        { status: 400 }
      );
    }
    
    const { action } = body;
    let success = false;
    
    switch (action) {
      case 'addNiche':
        scraperConfig.addNiche(db, body.name, body.priority ?? 0);
        success = true;
        break;
        
      case 'updateNiche':
        success = scraperConfig.updateNiche(db, body.id, {
          name: body.name,
          enabled: body.enabled,
          priority: body.priority,
        });
        break;
        
      case 'deleteNiche':
        success = scraperConfig.deleteNiche(db, body.id);
        break;
        
      case 'addCity':
        scraperConfig.addCity(db, body.name, body.department, body.priority ?? 0);
        success = true;
        break;
        
      case 'updateCity':
        success = scraperConfig.updateCity(db, body.id, {
          name: body.name,
          enabled: body.enabled,
          department: body.department,
          priority: body.priority,
        });
        break;
        
      case 'deleteCity':
        success = scraperConfig.deleteCity(db, body.id);
        break;
        
      case 'addDepartment':
        success = scraperConfig.addDepartment(db, body.code, body.name);
        break;
        
      case 'toggleDepartment':
        success = scraperConfig.toggleDepartment(db, body.code, body.enabled);
        break;
        
      case 'addExcludeKeyword':
        success = scraperConfig.addExcludeKeyword(db, body.keyword);
        break;
        
      case 'removeExcludeKeyword':
        success = scraperConfig.removeExcludeKeyword(db, body.keyword);
        break;
        
      case 'setSetting':
        success = scraperConfig.setSetting(db, body.key, body.value, body.description);
        break;
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
    // Return updated config
    return NextResponse.json({
      success,
      scrape: {
        niches: scraperConfig.getNicheNames(db),
        cities: scraperConfig.getCityNames(db),
      },
      allowed_departments: scraperConfig.getDepartments(db),
      exclude_keywords: scraperConfig.getExcludeKeywords(db),
      niches_detail: scraperConfig.getNiches(db, false),
      cities_detail: scraperConfig.getCities(db, false),
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}