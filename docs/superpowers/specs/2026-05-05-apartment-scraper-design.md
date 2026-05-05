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
| Scraping & Messaging | Puppeteer (headless, contexte persistant) |
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
│  Scheduler (setInterval 1-2min)                 │
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

### message_templates
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Nom du template |
| body | TEXT | Contenu du message |
| is_default | INTEGER | 1 = template par défaut |

### sessions
| Colonne | Type | Description |
|---------|------|-------------|
| id | INTEGER PK | Auto-increment |
| platform | TEXT | "leboncoin" ou "seloger" |
| cookies_path | TEXT | Chemin vers le fichier cookies |
| last_valid_at | TEXT | Dernière vérification valide |
| status | TEXT | "valid", "expired", "error" |

## Gestion des sessions & anti-bot

### Authentification
- Premier lancement : Puppeteer ouvre un navigateur visible (headful) pour connexion manuelle
- Cookies sauvegardés localement dans un fichier dédié par plateforme
- À chaque cycle : cookies réinjectés dans le contexte navigateur
- Si session expirée : alerte sur le dashboard, bouton "Se reconnecter"

### Anti-bot
- Un seul contexte navigateur persistant (pas de nouvelle instance à chaque cycle)
- Délais aléatoires entre les actions (scroll, clics, navigation)
- Rotation occasionnelle du user-agent
- Détection CAPTCHA → pause automatique + notification dashboard
- Trop d'échecs consécutifs → pause automatique (protection anti-ban)

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

## Déploiement
- Process Node.js unique qui tourne en continu
- Pas de containerisation nécessaire
- PC local toujours allumé
- Le backend sert aussi le frontend (build statique React servi par Express)
