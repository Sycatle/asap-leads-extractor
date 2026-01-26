# Plan d'implémentation - Scraper Societe.com

## Objectif

Remplacer l'enrichissement Pappers (payant) par un scraper Societe.com (gratuit) pour récupérer :
- **SIREN** de l'entreprise
- **Nom du dirigeant** (gérant, président, etc.)
- **Forme juridique** (SARL, SAS, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENRICHISSEMENT                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Lead (name, city)                                             │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                           │
│   │ Societe.com     │  Playwright (anti-bot)                    │
│   │ Scraper         │                                           │
│   └────────┬────────┘                                           │
│            │                                                    │
│            ▼                                                    │
│   1. Recherche: /cgi-bin/search?champs={name}+{city}            │
│            │                                                    │
│            ▼                                                    │
│   2. Parse résultats → Trouver le meilleur match                │
│            │                                                    │
│            ▼                                                    │
│   3. Accès fiche entreprise → Extraire données                  │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                           │
│   │ Update DB       │  siren, dirigeant, legal_name             │
│   └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sprints

### Sprint 1: Scraper de base
**Fichier:** `worker/enrichSociete.ts`

- [ ] Créer le scraper avec Playwright (réutiliser le browser du googleMapsScraper)
- [ ] Fonction `searchSociete(name, city)` → URL de la fiche entreprise
- [ ] Fonction `extractCompanyData(page)` → `{ siren, dirigeant, legal_name, forme_juridique }`
- [ ] Gestion anti-bot (délais aléatoires, user-agent réaliste)

### Sprint 2: Intégration workflow
**Fichiers:** `worker/enrich.ts`, `worker/cli.ts`

- [ ] Modifier `enrich.ts` pour utiliser Societe.com au lieu de Pappers
- [ ] Ajouter commande CLI `pnpm enrich:societe`
- [ ] Rate limiting: max 1 requête/3 secondes (éviter ban)
- [ ] Logging amélioré avec progression

### Sprint 3: Robustesse
- [ ] Gestion des erreurs (CAPTCHA, page non trouvée, etc.)
- [ ] Matching intelligent (fuzzy match nom entreprise)
- [ ] Cache des résultats pour éviter les doublons
- [ ] Retry avec backoff exponentiel

---

## Structure des données Societe.com

### Page de recherche
```
URL: https://www.societe.com/cgi-bin/search?champs=COIFFURE+LE+MANS
```

### Fiche entreprise (exemple)
```
URL: https://www.societe.com/societe/nom-entreprise-123456789.html

Données extractibles:
- Dénomination: "SALON DE COIFFURE EXEMPLE"
- SIREN: 123 456 789
- Dirigeant: "M Jean DUPONT (Gérant)"
- Forme juridique: SARL
- Adresse: 12 rue Example, 72000 LE MANS
```

### Sélecteurs CSS attendus
```css
/* Résultats de recherche */
.ResultBloc a.Link              /* Lien vers fiche */
.ResultBloc .txt                /* Nom entreprise */

/* Fiche entreprise */
#identite_deno                  /* Dénomination */
#siren_number                   /* SIREN */
.dirigeant-liste .nom           /* Nom dirigeant */
.dirigeant-liste .fonction      /* Fonction (Gérant, Président) */
```

---

## Considérations techniques

### Anti-bot
Societe.com a des protections modérées :
- ✅ User-Agent réaliste (Chrome)
- ✅ Délais aléatoires entre requêtes (2-5s)
- ✅ Pas de requêtes parallèles
- ⚠️ CAPTCHA possible après ~100 requêtes consécutives

### Performance
```
2600 leads ÷ 3s/lead = ~2h10 pour tout enrichir
Recommandation: batch de 200/jour = ~10 min/jour
```

### Fallback
Si Societe.com échoue :
1. Marquer le lead comme `enrichment_failed = true`
2. Réessayer plus tard avec variations du nom

---

## Commandes finales

```bash
# Enrichir 100 leads (batch par défaut)
pnpm enrich

# Enrichir tous les leads (long)
pnpm enrich --all

# Enrichir un lead spécifique
pnpm enrich --id 123
```

---

## Métriques de succès

| Métrique | Objectif |
|----------|----------|
| Taux de match | > 70% |
| Temps/lead | < 5s |
| Taux d'erreur | < 5% |
| Dirigeant trouvé | > 60% des matchs |
