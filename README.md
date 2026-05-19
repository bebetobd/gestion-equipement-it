# 🖥️ Gestion des Équipements Informatiques

Application web moderne pour gérer et suivre les équipements IT d'une organisation avec authentification, permissions granulaires et historique d'activités.

Application React + Vite avec backend Express pour gérer l'inventaire et le suivi des équipements IT.

## Commandes

- `npm run dev` : démarre seulement le frontend Vite.
- `npm run backend` : démarre le backend Express.
- `npm run dev:all` : démarre le frontend et le backend en même temps.
- `npm run build` : compile le frontend pour la production.

## Déploiement

- Pour une application frontend-only sur Vercel :
  - utilisez `npm run build`
  - configurez `Output Directory` à `dist`
  - définissez la variable d'environnement Vercel `VITE_API_BASE_URL` vers l'URL de votre backend (par exemple `https://mon-backend.example.com`)
  - si vous hébergez uniquement le frontend, le backend doit être sur un service dédié (Render, Railway, etc.)

- Si vous déployez le backend et le frontend ensemble sur un service Node persistant :
  - utilisez `npm run build`
  - puis `npm run start`
  - le backend doit être accessible à l'URL de votre app

## Variables d'environnement

- `VITE_API_BASE_URL` : URL du backend si l'API n'est pas servie depuis le même domaine que le frontend.

## URL

- Frontend : `http://localhost:5173`
- Backend : `http://localhost:4000/api/equipments`
- Export CSV : `http://localhost:4000/api/equipments/export`

## Authentification

L'application utilise une page de connexion et des comptes stockés dans `server/data/users.json`.

Comptes de test :

- `admin` / `admin2024` → rôle `admin` (CRUD complet)
- `technicien` / `tech2024` → rôle `technicien` (lecture seule)
- `utilisateur` / `user2024` → rôle `user` (lecture seule)

## Structure

- `src/` : application React
- `server/` : backend Express et données JSON
