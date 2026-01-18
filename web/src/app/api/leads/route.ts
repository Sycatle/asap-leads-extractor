import { NextRequest, NextResponse } from 'next/server';
import { findLeads, countLeads, getDistinctCities, getDistinctNiches } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      status: searchParams.get('status') as 'nouveau' | 'contacte' | 'qualifie' | 'proposition' | 'converti' | 'perdu' | undefined,
      call_status: searchParams.get('call_status') as 'non_appele' | 'appele' | 'messagerie' | 'rappeler' | 'injoignable' | undefined,
      city: searchParams.get('city') || undefined,
      niche: searchParams.get('niche') || undefined,
      priority: searchParams.get('priority') as 'high' | 'medium' | 'low' | undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '25'),
      offset: parseInt(searchParams.get('offset') || '0'),
      orderBy: searchParams.get('orderBy') || 'created_at',
      orderDir: (searchParams.get('orderDir') || 'desc') as 'asc' | 'desc',
    };
    
    const leads = findLeads(filters);
    const total = countLeads(filters);
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
