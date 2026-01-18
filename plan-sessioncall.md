# Objectif

Transformer la page **Session d’appel** en cockpit de prospection: **vitesse**, **contexte**, **next step forcé**, **traçabilité**.

---

# 1) Informations affichées (carte lead)

## 1.1 Bloc “Essentiel” (visible sans scroller)

* Nom + activité + ville
* Téléphone (1 clic) + badge type: **PRO / PERSO (risque B2C)**
* Score lead (priorité) + source (GMB, annuaire, scraping…)
* Dernier contact (date + résultat)
* Tentatives: **X/4 sur 30j** (si applicable)

## 1.2 Bloc “Contexte de vente”

* Site actuel: **URL + statut** (pas de site / site vieux / plateforme)
* Google Business: note + nb avis + lien
* Indices rapides: 2–3 tags auto (ex: “pas de RDV”, “pas de SEO”, “pas de photos récentes”)
* Horaires d’ouverture + “meilleur créneau d’appel” (calcul simple)

## 1.3 Bloc “Historique” (compact)

* Timeline 3 derniers événements: appel, email, sms, note
* Bouton “Voir tout” (modal)

---

# 2) Statuts d’appel (résultats)

## 2.1 Statuts minimum recommandés

* Injoignable
* Messagerie
* Mauvais numéro / mauvais contact
* Accueil / Gatekeeper
* À rappeler
* Intéressé
* RDV pris
* Devis envoyé
* Perdu (raison)
* Ne plus contacter (opt-out)

## 2.2 Raccourcis clavier

* 1–9 pour statuts principaux
* Enter = valider
* U = undo 5s
* N = focus note
* R = rappel rapide (+48h)

---

# 3) Next step forcé (workflow)

## 3.1 Règle

Aucun lead ne sort sans:

* **Action suivante** (tâche / rappel / email / RDV), ou
* **Clôture** (perdu / opt-out / mauvais contact)

## 3.2 Panneau post-statut (drawer ou modal)

### Selon statut

* Injoignable / Messagerie → choisir rappel (créneau + compteur tentative)
* Accueil / Gatekeeper → action: demander décideur / email via accueil / rappel
* Intéressé → RDV pris? (oui/non)

  * Non → email 1-pager + relance J+2
* RDV pris → création event calendrier + email confirmation
* Devis envoyé → relances J+2/J+7/J+14
* Perdu → raison + option rappel long terme
* Opt-out → blacklist interne + tag conformité

---

# 4) Actions rapides (one-click)

## 4.1 Barre d’actions contextuelle

* Envoyer SMS (templates)
* Envoyer email (templates)
* Créer tâche relance
* Créer RDV calendrier
* Ouvrir site / GMB / LinkedIn

## 4.2 Templates indispensables

* “J’ai tenté de vous joindre”
* “Proposition de créneaux”
* “Récap + prochaines étapes”
* “Confirmation RDV + agenda”
* “Relance devis (J+2/J+7/J+14)”

---

# 5) Notes & qualification (rapide)

## 5.1 Notes structurées (facultatif mais conseillé)

* Besoin (1 phrase)
* Budget (range)
* Timing
* Décideur (nom + rôle)
* Objection principale

## 5.2 Tags

* Métier, taille, urgence, maturité digitale, canal préféré

---

# 6) Métriques session (scoreboard)

## 6.1 Affichage en haut

* Appels passés
* Contacts (conversations)
* RDV pris
* Taux de contact

## 6.2 Objectif de session

* Progress bar: ex “20 appels / 2 RDV”

---

# 7) Conformité (silencieuse)

* Badge numéro perso (risque B2C)
* Avertissement si appel hors créneaux autorisés (selon règle configurée)
* Opt-out instant: “Ne plus contacter” (prioritaire)
* Journalisation: date/heure, résultat, opérateur, canal

---

# 8) UX vitesse (anti-frottement)

* Mode “Auto-next” après validation résultat (0.5–1s)
* Undo 5 secondes
* Loading optimisé: prefetch lead suivant
* Mobile: bottom sheet pour statuts + actions

---

# 9) Implémentation (ordre recommandé)

1. **Next step forcé** + statuts enrichis
2. **RDV pris** + intégration calendrier + templates
3. Carte lead enrichie (site/GMB/historique compact)
4. Actions rapides (SMS/email/tâches) + raccourcis
5. Scoreboard + objectifs
6. Conformité + logs

---

# 10) Critères d’acceptation

* Après chaque appel, l’utilisateur a soit une **action suivante planifiée**, soit une **clôture**.
* Un RDV se crée en **≤ 2 clics**.
* Un suivi (email/sms) part en **≤ 1 clic**.
* Le lead suivant s’affiche en **< 1s** (perçu).
* Opt-out effectif immédiatement + visible dans l’historique.
