"use client";

import { Plus, Rocket, X, Check, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

import { PageHeader } from "@/components/layout";
import { LoadingState } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Config {
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
    return <LoadingState message="Chargement de la configuration..." />;
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Erreur de chargement de la configuration</p>
      </div>
    );
  }

  const niches = config.scrape?.niches || [];
  const cities = config.scrape?.cities || [];
  const totalQueries = niches.length * cities.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader 
        title="Configuration"
        description="Gérez vos paramètres de scraping et d'exclusion"
      />

      {/* Status indicator */}
      {saving && (
        <div className="fixed top-20 right-4 bg-card text-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm shadow-lg border border-border">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Sauvegarde...
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Niches */}
        <ConfigSection title="Niches" emoji="📍" description="Types d'établissements à rechercher">
          <TagList 
            tags={niches} 
            onRemove={(tag) => updateNiches(niches.filter(n => n !== tag))} 
          />
          <div className="flex gap-2 mt-3">
            <Input
              value={newNiche}
              onChange={(e) => setNewNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNiche()}
              placeholder="ex: esthéticienne"
              className="flex-1"
            />
            <Button onClick={addNiche} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </ConfigSection>

        {/* Villes */}
        <ConfigSection title="Villes" emoji="🏙️" description="Zones géographiques à couvrir">
          <TagList 
            tags={cities} 
            onRemove={(tag) => updateCities(cities.filter(c => c !== tag))} 
          />
          <div className="flex gap-2 mt-3">
            <Input
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCity()}
              placeholder="ex: Nantes"
              className="flex-1"
            />
            <Button onClick={addCity} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </ConfigSection>

        {/* Mots-clés exclus */}
        <ConfigSection title="Exclusions" emoji="🚫" description="Chaînes et franchises à ignorer">
          <TagList 
            tags={config.exclude_keywords} 
            onRemove={(tag) => updateExcludeKeywords(config.exclude_keywords.filter(k => k !== tag))}
            variant="destructive"
          />
          <div className="flex gap-2 mt-3">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              placeholder="ex: Leclerc"
              className="flex-1"
            />
            <Button onClick={addKeyword} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </ConfigSection>

        {/* Lancer scrape */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Prêt à scraper ?</h3>
                <p className="text-sm text-muted-foreground">
                  {niches.length} niche(s) × {cities.length} ville(s) = {totalQueries} requêtes
                </p>
                {totalQueries > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimation: ~{Math.ceil(totalQueries * 30 / 60)} min
                  </p>
                )}
              </div>
              <Button 
                onClick={launchScrape}
                disabled={scraping || totalQueries === 0}
                size="lg"
                className="gap-2"
              >
                {scraping ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Lancer
                  </>
                )}
              </Button>
            </div>

            {/* Scrape result */}
            {scrapeResult && (
              <div className={`mt-4 p-4 rounded-lg ${scrapeResult.success ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'}`}>
                {scrapeResult.success ? (
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-success mt-0.5" />
                    <div>
                      <p className="font-medium text-success">Scrape terminé !</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {scrapeResult.results?.total_raw} trouvés → {scrapeResult.results?.after_dedup} uniques → {scrapeResult.results?.inserted_db} en base
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-danger mt-0.5" />
                    <div>
                      <p className="font-medium text-danger">Erreur</p>
                      <p className="text-sm text-muted-foreground mt-1">{scrapeResult.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConfigSection({ 
  title, 
  emoji,
  description, 
  children 
}: { 
  title: string;
  emoji: string;
  description: string; 
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function TagList({ 
  tags, 
  onRemove,
  variant = "default"
}: { 
  tags: string[]; 
  onRemove: (tag: string) => void;
  variant?: "default" | "destructive";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge 
          key={tag} 
          variant={variant === "destructive" ? "destructive" : "secondary"}
          className="gap-1.5 pr-1.5"
        >
          {tag}
          <button 
            onClick={() => onRemove(tag)}
            className="hover:bg-background/20 rounded-full p-0.5 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      {tags.length === 0 && (
        <span className="text-sm text-muted-foreground italic">Aucun élément</span>
      )}
    </div>
  );
}
