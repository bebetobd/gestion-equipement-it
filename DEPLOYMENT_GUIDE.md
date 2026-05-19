# 🚀 Guide de Déploiement Complet

## Vue d'ensemble du déploiement

```
Architecture Production:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Client Browser                                             │
│      ↓                                                       │
│  ┌─────────────────┐         ┌──────────────────┐          │
│  │   Vercel CDN    │◄───────►│ Railway/Render   │          │
│  │   (Frontend)    │ HTTPS   │ (Backend API)    │          │
│  └─────────────────┘         └────────┬─────────┘          │
│                                       │                     │
│                              ┌────────▼────────┐            │
│                              │  Neon/Railway   │            │
│                              │   PostgreSQL    │            │
│                              └─────────────────┘            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Options de Déploiement

| Composant | Options | Recommandé |
|-----------|---------|-----------|
| **Frontend** | Vercel, Netlify, GitHub Pages | 👉 **Vercel** |
| **Backend** | Railway, Render, Fly.io, Heroku | 👉 **Railway** |
| **Database** | Neon, Railway, Render, Supabase | 👉 **Neon** |

---

## ✅ Option 1: Vercel (Frontend) + Railway (Backend+DB)

### Étape 1: Préparer le repository GitHub

```bash
# 1. Initialiser git si pas déjà fait
git init
git add .
git commit -m "Initial commit - v2.0.0"

# 2. Créer un repository sur GitHub
# https://github.com/new
# Nommez-le: gestion-equipement-it

# 3. Pusher le code
git remote add origin https://github.com/YOUR_USERNAME/gestion-equipement-it.git
git branch -M main
git push -u origin main
```

### Étape 2: Déployer le Backend sur Railway

**Railway** héberge frontend + backend ensemble:

1. **Créer un compte** https://railway.app (connexion avec GitHub)

2. **Créer un nouveau projet**
   - Cliquer "Create New Project"
   - "Deploy from GitHub repo"
   - Sélectionner `gestion-equipement-it`

3. **Ajouter PostgreSQL**
   - Dans le tableau de bord Railway
   - Cliquer "Add" → "Database" → "PostgreSQL"

4. **Configurer les variables d'environnement**
   
   Aller dans "Variables" et ajouter:
   ```env
   # Base de données (Railway la génère automatiquement)
   DATABASE_URL=postgresql://...
   
   # JWT
   JWT_SECRET=<générer avec: openssl rand -hex 32>
   JWT_EXPIRES_IN=8h
   
   # Environment
   NODE_ENV=production
   PORT=4000
   
   # CORS
   VITE_API_BASE_URL=https://votre-railway-url.railway.app
   ```

5. **Build et Deploy**
   - Railway détecte `package.json` automatiquement
   - S'assurer que `npm start` dans package.json fonctionne
   - Deployment automatique après chaque push

### Étape 3: Déployer le Frontend sur Vercel

1. **Créer un compte Vercel**
   - https://vercel.com (connexion GitHub)

2. **Importer le projet**
   - Cliquer "Add New Project"
   - Sélectionner `gestion-equipement-it`
   - "Import"

3. **Configurer les variables d'environnement**

   Dans "Environment Variables":
   ```env
   VITE_API_BASE_URL=https://votre-railway-url.railway.app
   ```

4. **Configurer la build**

   Framework: `Vite`
   Build Command: `npm run build`
   Output Directory: `dist`

5. **Deploy**
   - Cliquer "Deploy"
   - Vercel build + deploy automatiquement

6. **Récupérer l'URL**
   - Copier l'URL Vercel (ex: `https://gestion-equipement-it.vercel.app`)

### Étape 4: Tester l'application

```bash
# Accéder à l'URL Vercel
https://gestion-equipement-it.vercel.app

# Tester la connexion
username: admin
password: admin2024
```

---

## ✅ Option 2: Render.com (Complet + Simple)

**Render** peut héberger backend + base de données facilement.

### Déployer Backend sur Render

1. **Créer un compte Render**
   - https://render.com

2. **Connecter GitHub**
   - Settings → GitHub → Connect GitHub

3. **Créer un Web Service**
   - "New +" → "Web Service"
   - Sélectionner le repo
   - Cliquer "Connect"

4. **Configurer le Service**
   ```
   Name: gestion-equipement-backend
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

5. **Ajouter les variables d'environnement**
   ```env
   DATABASE_URL=postgresql://...
   JWT_SECRET=<openssl rand -hex 32>
   NODE_ENV=production
   PORT=10000
   ```

6. **Créer une Base de Données PostgreSQL**
   - "New +" → "PostgreSQL"
   - Nommer: `gestion-equipement-db`
   - Copier le `DATABASE_URL` généré
   - Ajouter à Web Service

7. **Deploy**
   - Render deploy automatiquement

---

## ✅ Option 3: Déploiement Complet Neon (Recommandé)

**Meilleure combinaison:**
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Neon

### Créer base de données Neon

1. **Accéder à Neon**
   - https://neon.tech

2. **Créer un compte**
   - S'identifier avec GitHub

3. **Créer un nouveau projet**
   ```
   Project Name: gestion-equipement-it
   Database name: gestion_it
   Region: Sélectionner la plus proche
   ```

4. **Copier la connection string**
   ```
   postgresql://user:password@ep-xxx.neon.tech/gestion_it?sslmode=require
   ```

5. **Utiliser dans Railway/Render**
   - Ajouter `DATABASE_URL` de Neon
   - Railway/Render utiliseront cette DB

---

## 🔒 Sécurité - Checklist Pre-Deploy

```checklist
AVANT LE DÉPLOIEMENT:

JWT & Secrets:
- [ ] JWT_SECRET: openssl rand -hex 32
- [ ] Pas de secrets dans le code
- [ ] .env.local dans .gitignore

Database:
- [ ] DATABASE_URL valide
- [ ] SSL activé (sslmode=require)
- [ ] Backups configurés
- [ ] Utilisateur DB avec permissions limitées

CORS & Headers:
- [ ] CORS configuré pour l'URL frontend
- [ ] HTTPS activé partout
- [ ] Headers de sécurité (Helmet)

Code:
- [ ] NODE_ENV=production
- [ ] console.log() retiré
- [ ] Validation d'entrée active
- [ ] Gestion d'erreurs complète

Monitoring:
- [ ] Logs centralisés
- [ ] Error tracking (Sentry)
- [ ] Monitoring setup
- [ ] Alertes configurées
```

---

## 🔧 Configuration Production Détaillée

### server/.env.production

```env
# Environment
NODE_ENV=production
PORT=4000

# Database (Neon)
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/gestion_it?sslmode=require

# JWT
JWT_SECRET=<généré: openssl rand -hex 32>
JWT_EXPIRES_IN=8h

# CORS
ALLOWED_ORIGINS=https://votre-vercel-url.vercel.app

# Logging
LOG_LEVEL=info

# Frontend URL
VITE_API_BASE_URL=https://votre-railway-backend-url.railway.app
```

### vite.config.ts (Frontend)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
})
```

---

## 📊 Commandes Déploiement

### Build Local Test

```bash
# Build frontend
npm run build

# Tester le build
npm run preview

# Démarrer backend
npm run backend
```

### Build Production

```bash
# Complètement
npm install
npm run build

# Vérifier
ls -la dist/
```

---

## ✅ Post-Deployment Checklist

Après le déploiement:

```checklist
VÉRIFICATIONS:
- [ ] Frontend accessible: https://url-vercel.vercel.app
- [ ] Backend accessible: https://url-railway.railway.app/health
- [ ] API répond: GET /api/auth/me (devrait être 401)
- [ ] Login fonctionne: POST /api/auth/login
- [ ] Données s'affichent: GET /api/equipments

SÉCURITÉ:
- [ ] HTTPS partout ✅
- [ ] JWT_SECRET long ✅
- [ ] CORS restreint ✅
- [ ] Validation active ✅

MONITORING:
- [ ] Logs accessibles ✅
- [ ] Erreurs trackées ✅
- [ ] Alertes configurées ✅
- [ ] Backups actifs ✅

PERFORMANCES:
- [ ] Temps de réponse < 500ms
- [ ] Frontend en < 3s
- [ ] Database queries optimisées
- [ ] CDN configuré (Vercel)
```

---

## 🐛 Troubleshooting Déploiement

### Frontend
```
❌ Build failure
  → Vérifier package.json
  → npm run build localement
  → Vérifier variables d'env

❌ API calls failing
  → Vérifier VITE_API_BASE_URL
  → CORS errors? Vérifier backend CORS config
  → 401? Token pas envoyé - vérifier localStorage

❌ Page blanche
  → Vérifier les logs Vercel
  → Check network tab (F12)
  → Vérifier dist/ généré
```

### Backend
```
❌ Port déjà utilisé
  → Railway/Render assign port automatiquement
  → Vérifier PORT env var

❌ Database connection error
  → Vérifier DATABASE_URL
  → VPN/Network access? Neon/Railway à whitelister
  → SSL certificate? Ajouter ?sslmode=require

❌ 500 errors
  → Vérifier les logs en production
  → Railway: Logs → Recent Deploys
  → Render: Logs
  → Vérifier JWT_SECRET défini
```

---

## 📈 Monitoring Production

### Activer Sentry (Error Tracking)

```bash
npm install @sentry/node
```

```javascript
// server/app.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});

app.use(Sentry.Handlers.errorHandler());
```

### Logs Centralisés

```bash
npm install winston
```

### Auto-deploy après push

Railway/Render & Vercel déploient **automatiquement** après git push.

```bash
# Push = Auto deploy
git add .
git commit -m "Feature: nouvelle fonction"
git push origin main

# Vercel + Railway deployent automatiquement
```

---

## 💰 Coûts Estimés

| Service | Plan | Prix |
|---------|------|------|
| **Vercel** | Pro | $20/month |
| **Railway** | Pay-as-you-go | $5-50/month |
| **Neon** | Free-Pro | $0-150/month |
| **Total** | | ~$25-220/month |

**Alternative gratuit:**
- Vercel (free tier) - Frontend
- Railway (free $5 credit) - Backend
- Neon (free tier 0.5 GB) - Database

---

## 🎯 Résumé Étapes Rapides

### En 10 minutes:

1. **GitHub**: `git push` votre code
2. **Railway**: 
   - Connecter GitHub
   - Créer Web Service + PostgreSQL
   - Ajouter variables d'env
   - Deploy ✅
3. **Vercel**:
   - Importer project
   - Ajouter VITE_API_BASE_URL
   - Deploy ✅
4. **Test**: Accéder à URL Vercel ✅

### URLs Finales:

```
Frontend: https://gestion-equipement-it.vercel.app
Backend:  https://gestion-equipement-api.railway.app
Health:   https://gestion-equipement-api.railway.app/health
```

---

## 📚 Resources Utiles

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [Neon Docs](https://neon.tech/docs)
- [Production Checklist](ARCHITECTURE.md#-checklist-migration-vers-production)

---

**Prêt? Commencez par l'étape 1 du déploiement que vous choisissez!** 🚀
