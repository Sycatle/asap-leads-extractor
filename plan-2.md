# Plan v2 : CRM de Prospection Téléphonique

## 📊 Analyse de l'existant

### Ce qui existe déjà ✅

| Fonctionnalité | État | Notes |
|---------------|------|-------|
| Scraping Google Maps | ✅ OK | Via config UI, niches × villes |
| Base SQLite leads | ✅ OK | Phone unique, enrichissement Pappers |
| Statuts pipeline | ✅ Basique | nouveau/contacté/qualifié/converti/perdu |
| Statuts appel | ✅ Défini | non_appelé/appelé/messagerie/rappeler/injoignable |
| Notes | ✅ Basique | Append-only avec timestamp |
| Relances | ✅ Champ | `next_followup_at` existe mais non exploité |
| Liste leads | ✅ OK | Filtres, pagination, recherche |
| Stats dashboard | ✅ Basique | Total, à appeler, relances dues |

### Ce qui manque pour un vrai workflow commercial 🚫

1. **Pas de vue "Session d'appel"** - Le commercial doit tout faire manuellement
2. **Pas de fiche lead détaillée** - Impossible de consulter l'historique complet
3. **Pas de tracking des interactions** - Juste une note append-only
4. **Pas de gestion de relances intelligente** - Pas de rappels automatiques
5. **Pas de scripts d'appel** - Aide contextuelle pour le pitch
6. **Pas de statistiques de performance** - Taux d'appels/heure, conversion, etc.
7. **Interface non optimisée mobile** - Inutilisable en déplacement
8. **Pas de quick actions** - Trop de clics pour logger un appel

---

## 🎯 Persona : Sophie, commerciale B2B

**Contexte** : Sophie prospecte des coiffeurs et esthéticiennes pour vendre un logiciel de prise de RDV.

### Sa journée type (objectif)

| Heure | Action | Besoin app |
|-------|--------|------------|
| 9h00 | Commence sa session | Dashboard avec KPIs du jour |
| 9h05 | Lance le mode "Call" | File d'attente intelligente |
| 9h06 | Appelle Lead #1 | Click-to-call + fiche complète |
| 9h08 | Messagerie | 1 clic → "Messagerie" + planif rappel auto J+1 |
| 9h09 | Appelle Lead #2 | Prochain lead automatique |
| 9h12 | Discussion OK | 1 clic → "Intéressé" + note rapide |
| 12h00 | Pause | Stats matinée affichées |
| 14h00 | Relances du jour | Vue dédiée, triée par priorité |

### Frustrations à éviter

- ❌ "Je dois chercher le prochain à appeler"
- ❌ "J'oublie de noter ce qu'on s'est dit"
- ❌ "Je ne sais plus qui rappeler aujourd'hui"
- ❌ "Je ne vois pas mes stats en live"
- ❌ "C'est trop lent sur mon téléphone"

---

## 🏗️ Architecture v2

### Nouvelles pages

```
web/src/app/
├── page.tsx                    # Dashboard (refonte)
├── leads/
│   ├── page.tsx                # Liste leads (améliorations)
│   └── [id]/
│       └── page.tsx            # 🆕 Fiche lead détaillée
├── call/
│   └── page.tsx                # 🆕 Mode session d'appel
├── followups/
│   └── page.tsx                # 🆕 Vue relances du jour
├── config/
│   └── page.tsx                # Config (existant)
└── api/
    ├── leads/
    │   ├── route.ts            # GET/POST leads
    │   ├── [id]/
    │   │   ├── route.ts        # GET/PATCH lead
    │   │   ├── call/route.ts   # POST log appel
    │   │   ├── status/route.ts # PATCH status
    │   │   ├── followup/route.ts # PATCH relance
    │   │   └── history/route.ts  # 🆕 GET historique
    │   └── next/route.ts       # 🆕 GET prochain lead à appeler
    ├── stats/route.ts          # GET stats
    ├── session/route.ts        # 🆕 GET/POST session stats
    └── scripts/route.ts        # 🆕 GET scripts d'appel
```

### Nouveau modèle de données

```sql
-- Table historique des interactions
CREATE TABLE lead_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('call', 'email', 'note', 'status_change', 'followup_set')) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  duration_seconds INTEGER,  -- Durée appel si type=call
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Table sessions de prospection
CREATE TABLE call_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  total_calls INTEGER DEFAULT 0,
  total_reached INTEGER DEFAULT 0,     -- Conversations réelles
  total_voicemail INTEGER DEFAULT 0,
  total_scheduled INTEGER DEFAULT 0,   -- RDV/Relances planifiées
  notes TEXT
);

-- Table scripts d'appel
CREATE TABLE call_scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  niche TEXT,                          -- NULL = script par défaut
  type TEXT CHECK(type IN ('intro', 'objection', 'closing')) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Nouveaux index
CREATE INDEX idx_history_lead ON lead_history(lead_id);
CREATE INDEX idx_history_date ON lead_history(created_at);
```

---

## 📱 Nouvelles fonctionnalités

### 1. Dashboard refait (Homepage)

**Objectif** : Vue d'ensemble en 5 secondes

```
┌─────────────────────────────────────────────────────────────┐
│  📞 Leads Finder                    [Session active: 47min] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │    42    │ │    12    │ │     8    │ │   28%    │        │
│  │ À appeler│ │ Relances │ │ Appelés  │ │ Contact  │        │
│  │   today  │ │   dues   │ │ ce jour  │ │   rate   │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🚀 LANCER SESSION D'APPEL                              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  📊 Pipeline                                                 │
│  ┌─────┬─────┬─────┬─────┬─────┐                            │
│  │ 156 │  42 │  18 │   6 │   4 │                            │
│  │Nveau│Cntct│Quali│Propo│Convt│                            │
│  └─────┴─────┴─────┴─────┴─────┘                            │
│                                                              │
│  🔥 Relances urgentes (3)                                   │
│  ├─ Salon Beauté Plus - rappeler (en retard 2j)             │
│  ├─ Coiffure Élégance - envoyer devis                       │
│  └─ Institut Marie - démo planifiée 14h                     │
│                                                              │
│  📈 Performance semaine                                      │
│  [===========================] 78 appels / 100 objectif     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Mode Session d'Appel (`/call`)

**Objectif** : Interface minimaliste pour enchaîner les appels

```
┌─────────────────────────────────────────────────────────────┐
│  📞 Session d'appel         [⏱️ 00:47:23]  [📊 12 appels]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│        SALON BEAUTÉ ÉLÉGANCE                                │
│        ⭐ 4.6 (127 avis) • Coiffeur • Le Mans               │
│                                                              │
│        📱 02 43 XX XX XX                    [📞 APPELER]    │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💬 Script intro:                                        ││
│  │ "Bonjour, je suis [Prénom] de [Société]. Je vous       ││
│  │ appelle car j'ai vu que vous aviez d'excellents avis   ││
│  │ sur Google..."                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Résultat de l'appel:                                       │
│  ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐        │
│  │   📵   ││   📞   ││   📧   ││   🤝   ││   ❌   │        │
│  │Injoign.││Messagr.││Rappeler││Intéres.││Pas int.│        │
│  └────────┘└────────┘└────────┘└────────┘└────────┘        │
│                                                              │
│  Note rapide: [________________________________] [💾]       │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [⏭️ Passer] [👁️ Voir fiche] [⏸️ Pause session]       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Flux intelligent** :
1. L'app sélectionne le prochain lead selon priorité :
   - Relances du jour en premier (triées par heure)
   - Puis nouveaux leads par priorité (high > medium > low)
   - Puis leads en "rappeler" depuis > 24h
2. Un clic = résultat logué + next lead chargé
3. "Rappeler" ouvre un date picker (défaut = J+1 même heure)

### 3. Fiche Lead détaillée (`/leads/[id]`)

**Objectif** : Tout savoir avant/pendant l'appel

```
┌─────────────────────────────────────────────────────────────┐
│  [← Retour]              SALON BEAUTÉ ÉLÉGANCE              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────┬────────────────────────────────┐│
│  │ INFORMATIONS           │ STATUT                         ││
│  │                        │                                ││
│  │ 📱 02 43 XX XX XX      │ 🟡 Contacté                    ││
│  │ 🌐 salonbeaute.fr      │ 📞 Messagerie (2x)             ││
│  │ 📍 12 rue du Commerce  │ 📧 Non envoyé                  ││
│  │    72000 Le Mans       │                                ││
│  │                        │ ⏰ Relance: 19/01 10h00        ││
│  │ ⭐ 4.6 (127 avis)      │                                ││
│  │ 🏢 SIREN: 123456789    │ Priorité: 🔴 HIGH              ││
│  │ 👤 Marie Dupont (Gér.) │                                ││
│  └────────────────────────┴────────────────────────────────┘│
│                                                              │
│  📝 NOTES                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [18/01 14:32] 📞 Messagerie - laissé message            ││
│  │ [17/01 10:15] 📞 Messagerie - pas de réponse            ││
│  │ [16/01 09:30] 📞 Nouveau contact ajouté via scrape      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Ajouter une note: [____________________________] [➕]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ACTIONS RAPIDES                                             │
│  [📞 Appeler] [📧 Envoyer email] [📅 Planifier relance]     │
│  [✅ Marquer qualifié] [❌ Marquer perdu]                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Vue Relances (`/followups`)

**Objectif** : Ne jamais oublier un rappel

```
┌─────────────────────────────────────────────────────────────┐
│  📅 Relances du jour                      [18 janvier 2026] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🔴 EN RETARD (2)                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ⚠️ Coiff'Style - Le Mans        hier 16h   [📞][👁️][✓]││
│  │    "Rappeler après réflexion"                           ││
│  │ ⚠️ Institut Zen - Angers        -2 jours   [📞][👁️][✓]││
│  │    "Envoyer documentation"                              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  🟡 AUJOURD'HUI (5)                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🕐 Salon Marie - Laval           09:00    [📞][👁️][✓] ││
│  │    "Démo prévue"                                        ││
│  │ 🕐 Beauty Corner - Le Mans       10:30    [📞][👁️][✓] ││
│  │ 🕐 Espace Coiffure - Nantes      14:00    [📞][👁️][✓] ││
│  │ 🕐 Atelier Beauté - Rennes       15:30    [📞][👁️][✓] ││
│  │ 🕐 Studio Hair - Le Mans         17:00    [📞][👁️][✓] ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  🟢 DEMAIN (3)                                              │
│  └─ [voir plus...]                                          │
│                                                              │
│  Cette semaine: 12 relances | Semaine prochaine: 8          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5. Quick Actions améliorées

**Objectif** : Réduire à 1-2 clics maximum

| Action | Avant | Après |
|--------|-------|-------|
| Logger appel messagerie | N/A | 1 clic → auto-relance J+1 |
| Logger appel OK | N/A | 1 clic + modal note optionnelle |
| Marquer intéressé | Éditer → status → sauver | 1 clic |
| Planifier relance | Éditer → date → sauver | 1 clic → modal date/heure |
| Voir historique | N/A | 1 clic sur la ligne |
| Appeler | Cliquer tel → dialer | Click-to-call intégré |

---

## 🗓️ Plan d'implémentation

### Phase 1 : Fondations (1-2 jours)

- [ ] **1.1** Créer table `lead_history` + migration
- [ ] **1.2** API `/api/leads/[id]/history` - GET historique
- [ ] **1.3** Modifier `logCall()` pour écrire dans history
- [ ] **1.4** Modifier `updateStatus()` pour écrire dans history
- [ ] **1.5** Créer table `call_sessions`
- [ ] **1.6** API `/api/leads/next` - GET prochain lead intelligent

### Phase 2 : Fiche Lead (1 jour)

- [ ] **2.1** Page `/leads/[id]/page.tsx` - Layout
- [ ] **2.2** Composant `LeadInfo` - Infos générales
- [ ] **2.3** Composant `LeadHistory` - Timeline des interactions
- [ ] **2.4** Composant `LeadActions` - Quick actions
- [ ] **2.5** Composant `NoteInput` - Ajout note rapide
- [ ] **2.6** Lien depuis la liste des leads

### Phase 3 : Mode Session d'Appel (2 jours)

- [ ] **3.1** Page `/call/page.tsx` - Layout session
- [ ] **3.2** Composant `CurrentLead` - Lead actuel avec infos
- [ ] **3.3** Composant `CallOutcome` - Boutons résultat
- [ ] **3.4** Composant `QuickNote` - Note rapide inline
- [ ] **3.5** Composant `SessionStats` - Timer + compteurs live
- [ ] **3.6** Logique "next lead" automatique
- [ ] **3.7** Modal planification rappel (si outcome = rappeler)
- [ ] **3.8** Intégration script d'appel contextuel

### Phase 4 : Vue Relances (1 jour)

- [ ] **4.1** Page `/followups/page.tsx` - Layout
- [ ] **4.2** API `/api/followups` - GET relances triées
- [ ] **4.3** Groupement par date (retard/aujourd'hui/demain/semaine)
- [ ] **4.4** Quick actions inline (appeler/voir/fait)
- [ ] **4.5** Badge notification dans la nav

### Phase 5 : Dashboard refait (1 jour)

- [ ] **5.1** Refonte page `/page.tsx`
- [ ] **5.2** Composant `PipelineFunnel` - Visualisation pipeline
- [ ] **5.3** Composant `TodayStats` - KPIs du jour
- [ ] **5.4** Composant `UrgentFollowups` - Top 5 relances
- [ ] **5.5** Composant `WeeklyProgress` - Barre de progression
- [ ] **5.6** Bouton CTA "Lancer session"

### Phase 6 : Polish & Mobile (1 jour)

- [ ] **6.1** Responsive design toutes pages
- [ ] **6.2** Touch-friendly buttons (48px min)
- [ ] **6.3** Swipe actions sur mobile (liste leads)
- [ ] **6.4** PWA manifest pour installation
- [ ] **6.5** Dark mode cohérent
- [ ] **6.6** Animations feedback (succès/erreur)

---

## 📐 Spécifications techniques

### Logique "Next Lead" (priorité)

```typescript
function getNextLead(): Lead | null {
  // 1. Relances en retard (ordre: le plus ancien d'abord)
  const overdue = db.query(`
    SELECT * FROM leads 
    WHERE next_followup_at < datetime('now')
    AND status NOT IN ('converti', 'perdu')
    ORDER BY next_followup_at ASC
    LIMIT 1
  `);
  if (overdue) return overdue;
  
  // 2. Relances aujourd'hui (ordre: le plus tôt d'abord)
  const today = db.query(`
    SELECT * FROM leads 
    WHERE date(next_followup_at) = date('now')
    AND status NOT IN ('converti', 'perdu')
    ORDER BY next_followup_at ASC
    LIMIT 1
  `);
  if (today) return today;
  
  // 3. Nouveaux leads jamais appelés (ordre: priority DESC)
  const fresh = db.query(`
    SELECT * FROM leads 
    WHERE call_status = 'non_appele'
    AND status = 'nouveau'
    ORDER BY 
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at ASC
    LIMIT 1
  `);
  if (fresh) return fresh;
  
  // 4. Leads à rappeler depuis > 24h
  const stale = db.query(`
    SELECT * FROM leads 
    WHERE call_status = 'rappeler'
    AND last_contact_at < datetime('now', '-1 day')
    AND status NOT IN ('converti', 'perdu')
    ORDER BY last_contact_at ASC
    LIMIT 1
  `);
  return stale;
}
```

### Auto-relance après messagerie

```typescript
async function logCallOutcome(leadId: number, outcome: CallOutcome, note?: string) {
  const lead = await db.findById(leadId);
  
  // Log dans history
  await db.insertHistory({
    lead_id: leadId,
    type: 'call',
    old_value: lead.call_status,
    new_value: outcome,
    note,
  });
  
  // Update lead
  const updates: Partial<Lead> = {
    call_status: outcome,
    last_contact_at: new Date().toISOString(),
  };
  
  // Auto-relance si messagerie
  if (outcome === 'messagerie') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10h par défaut
    updates.next_followup_at = tomorrow.toISOString();
  }
  
  // Passage en "contacté" si premier contact
  if (lead.status === 'nouveau' && ['appele', 'messagerie'].includes(outcome)) {
    updates.status = 'contacte';
  }
  
  await db.updateLead(leadId, updates);
}
```

### Structure composants

```
web/src/components/
├── leads/
│   ├── LeadCard.tsx           # Carte résumée (liste)
│   ├── LeadInfo.tsx           # Infos complètes (fiche)
│   ├── LeadHistory.tsx        # Timeline interactions
│   ├── LeadActions.tsx        # Quick actions
│   └── LeadStatusBadge.tsx    # Badge statut coloré
├── call/
│   ├── CurrentLead.tsx        # Lead en cours d'appel
│   ├── CallOutcome.tsx        # Boutons résultat
│   ├── CallScript.tsx         # Script contextuel
│   ├── QuickNote.tsx          # Input note rapide
│   └── SessionStats.tsx       # Timer + compteurs
├── followups/
│   ├── FollowupList.tsx       # Liste groupée par date
│   └── FollowupItem.tsx       # Item avec quick actions
├── dashboard/
│   ├── PipelineFunnel.tsx     # Visualisation pipeline
│   ├── TodayStats.tsx         # KPIs du jour
│   └── UrgentFollowups.tsx    # Top relances urgentes
└── ui/
    ├── Modal.tsx              # Modal réutilisable
    ├── DateTimePicker.tsx     # Sélection date/heure
    ├── Toast.tsx              # Notifications feedback
    └── ConfirmDialog.tsx      # Confirmation action
```

---

## 🎯 KPIs de succès

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Temps pour logger un appel | < 3s | Stopwatch test |
| Appels/heure en session | > 15 | Stats session |
| Taux de relances honorées | > 90% | Relances faites / planifiées |
| Temps de chargement page | < 1s | Lighthouse |
| Satisfaction utilisateur | > 4/5 | Feedback Sophie |

---

## 🚀 Quick wins immédiats

Si temps limité, prioriser dans cet ordre :

1. **Mode Session d'Appel** → Impact max sur productivité
2. **Quick actions 1-clic** → Réduit friction
3. **Vue Relances** → Ne rien oublier
4. **Fiche Lead** → Contexte avant appel
5. **Dashboard** → Nice-to-have

---

## 📝 Notes de conception

### Philosophie UX

- **"Don't make me think"** : Actions évidentes, pas de confusion
- **"Inbox Zero"** : Leads = tâches à traiter, objectif = vider
- **"Mobile-first"** : Sophie peut prospecter depuis son café
- **"Feedback instant"** : Chaque action = confirmation visuelle

### Couleurs sémantiques

| Couleur | Signification |
|---------|--------------|
| 🔵 Bleu | Nouveau, informatif |
| 🟡 Jaune | En cours, attention |
| 🟣 Violet | Qualifié, avancé |
| 🟢 Vert | Converti, succès |
| 🔴 Rouge | Priorité haute, urgent |
| ⚫ Gris | Perdu, inactif |

### Raccourcis clavier (session)

| Touche | Action |
|--------|--------|
| `1` | Injoignable |
| `2` | Messagerie |
| `3` | Rappeler |
| `4` | Intéressé |
| `5` | Pas intéressé |
| `N` | Focus note |
| `Enter` | Sauver note |
| `Space` | Next lead |
| `Esc` | Pause session |
