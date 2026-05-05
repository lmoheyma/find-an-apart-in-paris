# Apartment Scraper — Design Spec

## Overview

Application qui scrape les nouvelles annonces d'appartement sur LeBonCoin et SeLoger selon des préférences configurables, et envoie automatiquement un message pré-défini (sur la plateforme + email) sans intervention manuelle.

## Contraintes

- Tourne en continu sur un PC local toujours allumé
- Polling toutes les 1-2 minutes
- Connexion manuelle une seule fois, sessions persistées via cookies
- L'utilisateur a des comptes actifs sur LeBonCoin et SeLoger

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Node.js + TypeScript, Express.js |
| Scraping & Messaging | puppeteer-extra + stealth plugin (headless, userDataDir persistant) |
| Frontend | React + Vite + TailwindCSS |
| Base de données | SQLite (via better-sqlite3) |
| Email | Nodemailer (SMTP, compte personnel) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Dashboard (React)                │
│  Config critères · Message template · Historique │
└─────────────────────┬───────────────────────────┘
                      │ API REST
┌─────────────────────▼───────────────────────────┐
│              Serveur Backend (Node.js)           │
├─────────────────────────────────────────────────┤
│  Scheduler (recursive setTimeout 1-2min)        │
│  ├── Scraper LeBonCoin (Puppeteer)              │
│  ├── Scraper SeLoger (Puppeteer)                │
│  ├── Déduplication (SQLite)                     │
│  ├── Messenger LeBonCoin (Puppeteer)            │
│  ├── Messenger SeLoger (Puppeteer)              │
│  └── Email Sender (Nodemailer/SMTP)             │
├─────────────────────────────────────────────────┤
│  Auth Manager (cookies persistés localement)    │
│  SQLite DB (annonces, historique, config)       │
└─────────────────────────────────────────────────┘
```

## Modèle de données (SQLite)

### listings
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| platform | TEXT | "leboncoin" ou "seloger" |
| external_id | TEXT | ID de l'annonce sur la plateforme |
| url | TEXT | Lien vers l'annonce |
| title | TEXT | Titre de l'annonce |
| price | INTEGER | Prix en euros |
| surface | INTEGER | Surface en m² |
| rooms | INTEGER | Nombre de pièces |
| city | TEXT | Ville/quartier |
| description | TEXT | Description complète |
| images | TEXT | JSON array d'URLs |
| contact_email | TEXT | Email du contact si disponible |
| discovered_at | TEXT | Timestamp ISO |

Contrainte UNIQUE sur (platform, external_id).

### messages_sent
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| listing_id | INTEGER FK | Référence vers listings |
| platform | TEXT | Plateforme utilisée |
| method | TEXT | "platform_message" ou "email" |
| status | TEXT | "sent", "failed", "pending" |
| sent_at | TEXT | Timestamp ISO |
| error | TEXT | Message d'erreur si échec |

### preferences
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nom de la recherche |
| city | TEXT | Ville ou quartier |
| budget_min | INTEGER | Budget minimum |
| budget_max | INTEGER | Budget maximum |
| surface_min | INTEGER | Surface minimale en m² |
| rooms_min | INTEGER | Nombre de pièces minimum |
| active | INTEGER | 1 = actif, 0 = inactif |
| created_at | TEXT | Timestamp ISO |
| updated_at | TEXT | Timestamp ISO |

### message_templates
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nom du template |
| body | TEXT | Contenu du message (supporte variables : {{title}}, {{price}}, {{city}}, {{surface}}, {{url}}) |
| is_default | INTEGER | 1 = template par défaut |
| created_at | TEXT | Timestamp ISO |
| updated_at | TEXT | Timestamp ISO |

### sessions
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| platform | TEXT | "leboncoin" ou "seloger" |
| user_data_dir | TEXT | Chemin vers le userDataDir Puppeteer de la plateforme |
| last_valid_at | TEXT | Dernière vérification valide |
| status | TEXT | "valid", "expired", "error" |

Note : chaque plateforme a son propre `userDataDir` Puppeteer qui contient cookies, localStorage, et tout l'état du navigateur. Pas de gestion manuelle de cookies — Puppeteer persiste tout automatiquement via le userDataDir.

## Gestion des sessions & anti-bot

### Authentification
- Premier lancement : Puppeteer ouvre un navigateur visible (headful) pour connexion manuelle
- Cookies sauvegardés localement dans un fichier dédié par plateforme
- À chaque cycle : cookies réinjectés dans le contexte navigateur
- Si session expirée : alerte sur le dashboard, bouton "Se reconnecter"

### Anti-bot
- `puppeteer-extra` avec `puppeteer-extra-plugin-stealth` (obligatoire — LeBonCoin utilise DataDome, SeLoger utilise Imperva/Akamai)
- Un seul contexte navigateur persistant via `userDataDir` (pas de nouvelle instance à chaque cycle)
- Délais aléatoires entre les actions (scroll, clics, navigation) — humanisation du comportement
- Fingerprint navigateur cohérent (résolution, timezone, langue, WebGL)
- Détection CAPTCHA → pause automatique + notification dashboard
- Trop d'échecs consécutifs → backoff exponentiel (pause 5min, 15min, 1h)
- Stratégie de dégradation : si scraping échoue de façon répétée, augmenter l'intervalle de polling automatiquement

### Rate-limiting messages
- Maximum configurable de messages par heure (défaut : 5/heure)
- Délai aléatoire entre chaque envoi de message (1-3 min)
- Les messages sont mis en queue et envoyés séquentiellement, pas immédiatement après détection
- Risque de ban documenté : utiliser un compte secondaire est recommandé pour le messaging

## Flux d'exécution

```
Toutes les 1-2 min :
│
├─ Pour chaque préférence active :
│   ├─ Construire l'URL de recherche (filtres plateforme)
│   ├─ Naviguer via Puppeteer (cookies injectés)
│   ├─ Extraire les annonces de la page de résultats
│   └─ Pour chaque annonce :
│       ├─ Déjà vue (external_id en DB) ? → skip
│       ├─ Nouvelle → sauvegarder en DB
│       ├─ Envoyer message sur la plateforme (Puppeteer)
│       ├─ Email disponible ? → envoyer via SMTP
│       └─ Logger le résultat (succès/échec)
│
├─ Si CAPTCHA détecté → pause + alerte dashboard
├─ Si session expirée → alerte dashboard
└─ Mettre à jour les stats
```

## Gestion d'erreurs
- Message échoué → retry une fois après 5 min, puis marqué "failed"
- Trop d'échecs consécutifs → pause automatique du scraping
- Toutes les erreurs loggées et visibles dans le dashboard

## Dashboard (React SPA)

### Pages
- **Préférences** : CRUD des recherches (ville, budget, surface, pièces), activation/désactivation
- **Messages** : édition des templates, choix du template par défaut, prévisualisation
- **Annonces** : tableau paginé avec filtres (plateforme, date, statut message). Affiche titre, prix, surface, ville, lien, statut contact
- **Historique/Stats** : annonces détectées/jour, messages envoyés, taux de succès, graphiques
- **Sessions** : état de connexion par plateforme, bouton "Se reconnecter"

### API REST (Express)
Endpoints CRUD pour : preferences, message_templates, listings, sessions, stats.

## Template variables

Les templates de message supportent l'interpolation de variables via la syntaxe `{{variable}}` :

| Variable | Valeur |
|----------|--------|
| `{{title}}` | Titre de l'annonce |
| `{{price}}` | Prix en euros |
| `{{city}}` | Ville/quartier |
| `{{surface}}` | Surface en m² |
| `{{rooms}}` | Nombre de pièces |
| `{{url}}` | Lien vers l'annonce |

Exemple : "Bonjour, je suis intéressé par votre annonce {{title}} à {{price}}€. Seriez-vous disponible pour une visite ?"

## Logging & observabilité

- Logs structurés (JSON) écrits sur stdout + fichier rotatif (`logs/app.log`, rotation quotidienne, rétention 7 jours)
- Niveaux : error, warn, info, debug
- Librairie : `pino` (performant, structured logging)
- Les erreurs critiques (session expirée, CAPTCHA, ban détecté) sont aussi surfacées dans le dashboard

## Scheduling robuste

- Utilisation de `setTimeout` récursif (pas `setInterval`) pour éviter le drift et l'overlap
- Chaque cycle attend que le précédent soit terminé avant de relancer
- Si un cycle dépasse le temps attendu, le suivant démarre immédiatement après (pas d'accumulation)

## Graceful shutdown

- Gestion des signaux SIGTERM/SIGINT
- Fermeture propre du navigateur Puppeteer
- Flush des logs et fermeture de la DB SQLite
- Process supervisé via `pm2` pour redémarrage automatique en cas de crash

## Email — clarification

L'email n'est envoyé que si l'adresse email du propriétaire/agence est explicitement visible sur la page de l'annonce. La plupart des annonces sur LeBonCoin/SeLoger n'exposent pas l'email directement (formulaire de contact uniquement). L'email est donc un canal opportuniste, pas le canal principal.

## Déploiement
- Process Node.js unique supervisé par pm2
- Pas de containerisation nécessaire
- PC local toujours allumé
- Le backend sert aussi le frontend (build statique React servi par Express)
- Endpoint `/health` pour vérifier que le process est actif
