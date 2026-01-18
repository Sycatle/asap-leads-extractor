"use client";

import { Plus, Rocket, X, Loader2, Check, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

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

interface ScrapeResult {
  success: boolean;
  results?: {
    total_raw: number;
    after_dedup: number;
    inserted_db: number;
  };
  error?: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  
  const [newNiche, setNewNiche] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  // Load config on mount
  useEffect(() => {
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Save config
  const saveConfig = useCallback(async (newConfig: Config) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error("Failed to save config:", error);
    }
    setSaving(false);
  }, []);

  // Update helpers
  const updateNiches = (niches: string[]) => {
    if (!config) return;
    const newConfig = { ...config, scrape: { ...config.scrape, niches, cities: config.scrape?.cities || [] } };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const updateCities = (cities: string[]) => {
    if (!config) return;
    const newConfig = { ...config, scrape: { ...config.scrape, niches: config.scrape?.niches || [], cities } };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const updateExcludeKeywords = (exclude_keywords: string[]) => {
    if (!config) return;
    const newConfig = { ...config, exclude_keywords };
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  // Add handlers
  const addNiche = () => {
    if (!config || !newNiche.trim()) return;
    const niches = config.scrape?.niches || [];
    if (!niches.includes(newNiche.trim())) {
      updateNiches([...niches, newNiche.trim()]);
      setNewNiche("");
    }
  };

  const addCity = () => {
    if (!config || !newCity.trim()) return;
    const cities = config.scrape?.cities || [];
    if (!cities.includes(newCity.trim())) {
      updateCities([...cities, newCity.trim()]);
      setNewCity("");
    }
  };

  const addKeyword = () => {
    if (!config || !newKeyword.trim()) return;
    if (!config.exclude_keywords.includes(newKeyword.trim())) {
      updateExcludeKeywords([...config.exclude_keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  // Launch scrape
  const launchScrape = async () => {
    if (!config) return;
    
    setScraping(true);
    setScrapeResult(null);
    
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niches: config.scrape?.niches || ["coiffeur"],
          cities: config.scrape?.cities || ["Le Mans"],
        }),
      });
      
      const data = await res.json();
      setScrapeResult(data);
    } catch (error) {
      setScrapeResult({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erreur inconnue" 
      });
    }
    
    setScraping(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Erreur de chargement de la configuration</p>
      </div>
    );
  }

  const niches = config.scrape?.niches || [];
  const cities = config.scrape?.cities || [];
  const totalQueries = niches.length * cities.length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Status indicator */}
      {saving && (
        <div className="fixed top-20 right-4 bg-zinc-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm shadow-lg">
          <Loader2 className="w-4 h-4 animate-spin" />
          Sauvegarde...
        </div>
      )}

      {/* Niches */}
      <ConfigSection title="📍 Niches" description="Types d'établissements à rechercher">
        <TagList 
          tags={niches} 
          onRemove={(tag) => updateNiches(niches.filter(n => n !== tag))} 
        />
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newNiche}
            onChange={(e) => setNewNiche(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNiche()}
            placeholder="ex: esthéticienne"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          />
          <button
            onClick={addNiche}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </ConfigSection>

      {/* Villes */}
      <ConfigSection title="🏙️ Villes" description="Zones géographiques à couvrir">
        <TagList 
          tags={cities} 
          onRemove={(tag) => updateCities(cities.filter(c => c !== tag))} 
        />
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCity()}
            placeholder="ex: Nantes"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          />
          <button
            onClick={addCity}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </ConfigSection>

      {/* Mots-clés exclus */}
      <ConfigSection title="🚫 Exclusions" description="Chaînes et franchises à ignorer">
        <TagList 
          tags={config.exclude_keywords} 
          onRemove={(tag) => updateExcludeKeywords(config.exclude_keywords.filter(k => k !== tag))}
          variant="red"
        />
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="ex: Leclerc"
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
          />
          <button
            onClick={addKeyword}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </ConfigSection>

      {/* Lancer scrape */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Prêt à scraper ?</h3>
            <p className="text-sm text-blue-100">
              {niches.length} niche(s) × {cities.length} ville(s) = {totalQueries} requêtes
            </p>
            {totalQueries > 0 && (
              <p className="text-xs text-blue-200 mt-1">
                Estimation: ~{Math.ceil(totalQueries * 30 / 60)} min
              </p>
            )}
          </div>
          <button 
            onClick={launchScrape}
            disabled={scraping || totalQueries === 0}
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scraping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Lancer le Scrape
              </>
            )}
          </button>
        </div>

        {/* Scrape result */}
        {scrapeResult && (
          <div className={`mt-4 p-4 rounded-lg ${scrapeResult.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            {scrapeResult.success ? (
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-300 mt-0.5" />
                <div>
                  <p className="font-medium">Scrape terminé !</p>
                  <p className="text-sm text-blue-100 mt-1">
                    {scrapeResult.results?.total_raw} trouvés → {scrapeResult.results?.after_dedup} uniques → {scrapeResult.results?.inserted_db} en base
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-300 mt-0.5" />
                <div>
                  <p className="font-medium">Erreur</p>
                  <p className="text-sm text-red-200 mt-1">{scrapeResult.error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigSection({ 
  title, 
  description, 
  children 
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <p className="text-sm text-zinc-500 mb-4">{description}</p>
      {children}
    </div>
  );
}

function TagList({ 
  tags, 
  onRemove,
  variant = "default"
}: { 
  tags: string[]; 
  onRemove: (tag: string) => void;
  variant?: "default" | "red";
}) {
  const colors = variant === "red" 
    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span 
          key={tag} 
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${colors}`}
        >
          {tag}
          <button 
            onClick={() => onRemove(tag)}
            className="hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      {tags.length === 0 && (
        <span className="text-sm text-zinc-400 italic">Aucun élément</span>
      )}
    </div>
  );
}
