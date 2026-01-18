import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

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

export async function GET() {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return NextResponse.json(getDefaultConfig());
    }
    
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json(getDefaultConfig());
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Merge with defaults
    const current = existsSync(CONFIG_PATH) 
      ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      : getDefaultConfig();
    
    const updated = { ...current, ...body };
    
    writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
