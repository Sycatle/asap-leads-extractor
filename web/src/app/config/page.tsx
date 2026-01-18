"use client";

import { Plus, Rocket, X } from "lucide-react";
import { useState } from "react";

export default function ConfigPage() {
  const [niches, setNiches] = useState<string[]>(["coiffeur", "barbier"]);
  const [cities, setCities] = useState<string[]>(["Le Mans", "Angers"]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>(["Carrefour", "McDonald's"]);
  
  const [newNiche, setNewNiche] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const addNiche = () => {
    if (newNiche.trim() && !niches.includes(newNiche.trim())) {
      setNiches([...niches, newNiche.trim()]);
      setNewNiche("");
    }
  };

  const addCity = () => {
    if (newCity.trim() && !cities.includes(newCity.trim())) {
      setCities([...cities, newCity.trim()]);
      setNewCity("");
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !excludeKeywords.includes(newKeyword.trim())) {
      setExcludeKeywords([...excludeKeywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Niches */}
      <ConfigSection title="📍 Niches" description="Types d'établissements à rechercher">
        <TagList 
          tags={niches} 
          onRemove={(tag) => setNiches(niches.filter(n => n !== tag))} 
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
          onRemove={(tag) => setCities(cities.filter(c => c !== tag))} 
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
          tags={excludeKeywords} 
          onRemove={(tag) => setExcludeKeywords(excludeKeywords.filter(k => k !== tag))}
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
              {niches.length} niche(s) × {cities.length} ville(s) = {niches.length * cities.length} requêtes
            </p>
          </div>
          <button 
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 flex items-center gap-2 transition-colors"
          >
            <Rocket className="w-5 h-5" />
            Lancer le Scrape
          </button>
        </div>
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
