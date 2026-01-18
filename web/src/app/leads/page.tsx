"use client";

import { Users, Phone, Calendar, TrendingUp, ChevronLeft, ChevronRight, Loader2, ExternalLink, Eye } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Lead {
  id: number;
  name: string;
  phone: string;
  address: string;
  city: string;
  niche: string;
  rating: number | null;
  review_count: number | null;
  website: string | null;
  status: string;
  priority: string | null;
  notes: string | null;
  next_followup: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  by_status: Record<string, number>;
  to_call: number;
  followups_due: number;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  cities: string[];
  niches: string[];
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  converted: "Converti",
  lost: "Perdu",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  qualified: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  converted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  lost: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-zinc-500 dark:text-zinc-500",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [niches, setNiches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [niche, setNiche] = useState("");
  const [search, setSearch] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Fetch stats
  useEffect(() => {
    fetch("/api/stats")
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (status) params.set("status", status);
    if (city) params.set("city", city);
    if (niche) params.set("niche", niche);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/leads?${params}`);
      const data: LeadsResponse = await res.json();
      setLeads(data.leads);
      setTotal(data.total);
      if (data.cities.length > 0) setCities(data.cities);
      if (data.niches.length > 0) setNiches(data.niches);
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    }
    setLoading(false);
  }, [page, status, city, niche, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status, city, niche, search]);

  const totalPages = Math.ceil(total / limit);
  const conversionRate = stats && stats.total > 0 
    ? Math.round((stats.by_status.converted || 0) / stats.total * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          icon={Users} 
          label="Total leads" 
          value={stats?.total ?? 0} 
          color="blue" 
        />
        <StatCard 
          icon={Phone} 
          label="À appeler" 
          value={stats?.to_call ?? 0} 
          color="orange" 
        />
        <StatCard 
          icon={Calendar} 
          label="Relances" 
          value={stats?.followups_due ?? 0} 
          color="purple" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Conversion" 
          value={`${conversionRate}%`} 
          color="green" 
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm text-zinc-500">Filtres:</span>
          
          {/* Status filter */}
          <select 
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          >
            <option value="">Tous les status</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* City filter */}
          <select 
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          >
            <option value="">Toutes les villes</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Niche filter */}
          <select 
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          >
            <option value="">Toutes les niches</option>
            {niches.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm flex-1 min-w-[150px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Ville
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Niche
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Note
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                      <p>Aucun lead trouvé</p>
                      <p className="text-sm">Lancez un scrape depuis l&apos;onglet Config</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{lead.name}</p>
                        {lead.priority && (
                          <span className={`text-xs ${PRIORITY_COLORS[lead.priority] || ""}`}>
                            {lead.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {lead.city || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {lead.niche || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {lead.phone ? (
                        <a 
                          href={`tel:${lead.phone}`}
                          className="text-sm font-mono text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lead.rating ? (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          ⭐ {lead.rating} ({lead.review_count})
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>
                        {STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lead.website && (
                          <a 
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            title="Voir le site"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {lead.phone && (
                          <a 
                            href={`tel:${lead.phone}`}
                            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-green-600 dark:hover:text-green-400"
                            title="Appeler"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <Link
                          href={`/leads/${lead.id}`}
                          className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Voir la fiche"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">
              {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} sur {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color: "blue" | "orange" | "purple" | "green";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
          <p className="text-sm text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
