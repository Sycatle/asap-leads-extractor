import { NextRequest, NextResponse } from 'next/server';
import { findLeadsAdvanced, countLeadsAdvanced, getDistinctCities, getDistinctNiches } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse boolean filter helper
    const parseBoolFilter = (value: string | null): 'all' | 'yes' | 'no' => {
      if (value === 'yes' || value === 'no') return value;
      return 'all';
    };

    const filters = {
      // Basic filters
      status: searchParams.get('status') as 'nouveau' | 'contacte' | 'qualifie' | 'proposition' | 'converti' | 'perdu' | undefined,
      call_status: searchParams.get('call_status') as 'non_appele' | 'appele' | 'rappeler' | 'injoignable' | undefined,
      city: searchParams.get('city') || undefined,
      niche: searchParams.get('niche') || undefined,
      priority: searchParams.get('priority') as 'high' | 'medium' | 'low' | undefined,
      search: searchParams.get('search') || undefined,
      
      // Boolean filters
      hasWebsite: parseBoolFilter(searchParams.get('hasWebsite')),
      hasDirigeant: parseBoolFilter(searchParams.get('hasDirigeant')),
      hasSiren: parseBoolFilter(searchParams.get('hasSiren')),
      hasPhone: parseBoolFilter(searchParams.get('hasPhone')),
      hasLegalExtracted: parseBoolFilter(searchParams.get('hasLegalExtracted')),
      
      // Range filters
      scoreMin: searchParams.get('scoreMin') ? parseInt(searchParams.get('scoreMin')!) : undefined,
      scoreMax: searchParams.get('scoreMax') ? parseInt(searchParams.get('scoreMax')!) : undefined,
      ratingMin: searchParams.get('ratingMin') ? parseFloat(searchParams.get('ratingMin')!) : undefined,
      ratingMax: searchParams.get('ratingMax') ? parseFloat(searchParams.get('ratingMax')!) : undefined,
      
      // Date filters
      createdAfter: searchParams.get('createdAfter') || undefined,
      createdBefore: searchParams.get('createdBefore') || undefined,
      
      // Pagination & sorting
      limit: parseInt(searchParams.get('limit') || '25'),
      offset: parseInt(searchParams.get('offset') || '0'),
      orderBy: searchParams.get('orderBy') || 'created_at',
      orderDir: (searchParams.get('orderDir') || 'desc') as 'asc' | 'desc',
    };
    
    const leads = findLeadsAdvanced(filters);
    const total = countLeadsAdvanced(filters);
    const cities = getDistinctCities();
    const niches = getDistinctNiches();
    
    return NextResponse.json({
      leads,
      total,
      page: Math.floor(filters.offset / filters.limit) + 1,
      totalPages: Math.ceil(total / filters.limit),
      cities,
      niches,
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
