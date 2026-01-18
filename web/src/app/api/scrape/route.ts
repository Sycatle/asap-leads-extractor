import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const niches = body.niches as string[] || ['coiffeur'];
    const cities = body.cities as string[] || ['Le Mans'];
    
    const projectRoot = path.join(process.cwd(), '..');
    
    // Build the command
    const nichesArg = niches.join(',');
    const citiesArg = cities.join(',');
    const cmd = `cd "${projectRoot}" && pnpm scrape --niches "${nichesArg}" --cities "${citiesArg}" --skip-enrich`;
    
    // Execute scrape (this may take a while)
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 600000, // 10 minutes timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });
    
    // Parse results from stdout
    const totalMatch = stdout.match(/Total brut: (\d+)/);
    const dedupMatch = stdout.match(/Après dédup: (\d+)/);
    const dbMatch = stdout.match(/Insérés en DB: (\d+)/);
    
    return NextResponse.json({
      success: true,
      message: 'Scrape completed',
      results: {
        total_raw: totalMatch ? parseInt(totalMatch[1]) : 0,
        after_dedup: dedupMatch ? parseInt(dedupMatch[1]) : 0,
        inserted_db: dbMatch ? parseInt(dbMatch[1]) : 0,
      },
      stdout,
      stderr,
    });
  } catch (error) {
    console.error('Error running scrape:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run scrape',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
